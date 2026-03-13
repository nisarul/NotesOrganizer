import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

interface Notebook {
  id: string;
  name: string;
  color: string;
  folders: FolderItem[];
}

interface FolderItem {
  id: string;
  name: string;
  children?: FolderItem[];
}

interface Props {
  currentNotebookId: string;
  currentFolderId: string | null;
  onSelect: (notebookId: string, folderId: string | null) => void;
  onClose: () => void;
  title?: string;
}

export default function MoveNoteModal({ currentNotebookId, currentFolderId, onSelect, onClose, title = 'Move to...' }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([currentNotebookId]));

  const { data } = useQuery({
    queryKey: ['notebooks'],
    queryFn: () => api<{ notebooks: Notebook[] }>('/notebooks'),
  });

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const isCurrent = (nbId: string, fId: string | null) =>
    nbId === currentNotebookId && fId === currentFolderId;

  const renderFolder = (folder: FolderItem, nbId: string, depth: number) => {
    const isExpanded = expanded.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <button
          onClick={() => onSelect(nbId, folder.id)}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-accent transition-colors rounded ${
            isCurrent(nbId, folder.id) ? 'bg-accent text-primary font-medium' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <span onClick={(e) => { e.stopPropagation(); toggle(folder.id); }} className="cursor-pointer">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          ) : <span className="w-3" />}
          {isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-blue-500" /> : <Folder className="w-3.5 h-3.5 text-blue-500" />}
          {folder.name}
        </button>
        {isExpanded && folder.children?.map(child => renderFolder(child, nbId, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-80 max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border font-medium text-sm">{title}</div>
        <div className="overflow-y-auto max-h-72 py-1">
          {data?.notebooks.map(nb => {
            const isExpanded = expanded.has(nb.id);
            return (
              <div key={nb.id}>
                <button
                  onClick={() => onSelect(nb.id, null)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm hover:bg-accent transition-colors rounded ${
                    isCurrent(nb.id, null) ? 'bg-accent text-primary font-medium' : ''
                  }`}
                >
                  <span onClick={(e) => { e.stopPropagation(); toggle(nb.id); }} className="cursor-pointer">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: nb.color }} />
                  {nb.name}
                </button>
                {isExpanded && nb.folders.map(f => renderFolder(f, nb.id, 1))}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded hover:bg-accent transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
