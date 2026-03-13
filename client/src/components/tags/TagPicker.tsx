import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  color: string;
  _count?: { notes: number };
}

interface NoteTag {
  tag: TagData;
}

interface Props {
  noteId: string;
  noteTags: NoteTag[];
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

export default function TagPicker({ noteId, noteTags }: Props) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const { data: allTags } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api<{ tags: TagData[] }>('/tags'),
    enabled: showPicker,
  });

  const assignTag = useMutation({
    mutationFn: (tagId: string) =>
      api(`/tags/notes/${noteId}/tags`, { method: 'POST', body: JSON.stringify({ tagId }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) =>
      api(`/tags/notes/${noteId}/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const createTag = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      api<{ tag: TagData }>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      assignTag.mutate(data.tag.id);
      setNewTagName('');
      toast.success('Tag created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignedIds = new Set(noteTags.map(nt => nt.tag.id));
  const availableTags = allTags?.tags.filter(t => !assignedIds.has(t.id)) || [];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {noteTags.map(({ tag }) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
        >
          {tag.name}
          <button
            onClick={() => removeTag.mutate(tag.id)}
            className="hover:opacity-70 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:bg-accent transition-colors border border-dashed border-border"
        >
          <Plus className="w-3 h-3" />
          <span>Tag</span>
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
            {/* Existing tags */}
            {availableTags.length > 0 && (
              <div className="max-h-32 overflow-y-auto">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => { assignTag.mutate(tag.id); setShowPicker(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}

            {availableTags.length > 0 && <div className="border-t border-border my-1" />}

            {/* Create new tag */}
            <div className="px-3 py-2 space-y-2">
              <div className="text-xs text-muted-foreground font-medium">Create new tag</div>
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                className="w-full text-xs px-2 py-1 bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTagName.trim()) {
                    createTag.mutate({ name: newTagName.trim(), color: newTagColor });
                  }
                }}
              />
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={() => { if (newTagName.trim()) createTag.mutate({ name: newTagName.trim(), color: newTagColor }); }}
                disabled={!newTagName.trim()}
                className="w-full text-xs py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Create & Assign
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
