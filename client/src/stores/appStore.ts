import { create } from 'zustand';

interface AppState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Selected items
  selectedNotebookId: string | null;
  selectedFolderId: string | null;
  selectedNoteId: string | null;
  setSelectedNotebook: (id: string | null) => void;
  setSelectedFolder: (id: string | null) => void;
  setSelectedNote: (id: string | null) => void;

  // Editor mode
  editorMode: 'wysiwyg' | 'split';
  setEditorMode: (mode: 'wysiwyg' | 'split') => void;

  // Expanded tree nodes
  expandedNodes: Set<string>;
  toggleNode: (id: string) => void;
  expandNode: (id: string) => void;
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;

  // Recently opened notes
  recentNotes: { id: string; title: string }[];
  addRecentNote: (id: string, title: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  selectedNotebookId: null,
  selectedFolderId: null,
  selectedNoteId: null,
  setSelectedNotebook: (id) => set({ selectedNotebookId: id }),
  setSelectedFolder: (id) => set({ selectedFolderId: id }),
  setSelectedNote: (id) => set({ selectedNoteId: id }),

  editorMode: (localStorage.getItem('editorMode') as 'wysiwyg' | 'split') || 'wysiwyg',
  setEditorMode: (mode) => {
    localStorage.setItem('editorMode', mode);
    set({ editorMode: mode });
  },

  expandedNodes: new Set<string>(),
  toggleNode: (id) =>
    set((s) => {
      const next = new Set(s.expandedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedNodes: next };
    }),
  expandNode: (id) =>
    set((s) => {
      const next = new Set(s.expandedNodes);
      next.add(id);
      return { expandedNodes: next };
    }),
  expandAll: (ids) => set({ expandedNodes: new Set(ids) }),
  collapseAll: () => set({ expandedNodes: new Set() }),

  recentNotes: JSON.parse(localStorage.getItem('recentNotes') || '[]'),
  addRecentNote: (id, title) =>
    set((s) => {
      const filtered = s.recentNotes.filter((n) => n.id !== id);
      const updated = [{ id, title }, ...filtered].slice(0, 10);
      localStorage.setItem('recentNotes', JSON.stringify(updated));
      return { recentNotes: updated };
    }),
}));
