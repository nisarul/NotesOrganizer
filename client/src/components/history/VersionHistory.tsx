import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { History, RotateCcw, X } from 'lucide-react';

interface Version {
  id: string;
  versionNumber: number;
  message: string | null;
  createdAt: string;
}

interface Props {
  noteId: string;
  onClose: () => void;
}

export default function VersionHistory({ noteId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['versions', noteId],
    queryFn: () => api<{ versions: Version[] }>(`/notes/${noteId}/versions`),
  });

  const loadVersion = async (versionId: string) => {
    setSelectedVersion(versionId);
    const result = await api<{ version: Version; content: string }>(`/notes/${noteId}/versions/${versionId}`);
    setPreviewContent(result.content);
  };

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) =>
      api(`/notes/${noteId}/versions/${versionId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['versions', noteId] });
      toast.success('Version restored');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Version History</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Version list */}
          <div className="w-56 border-r border-border overflow-y-auto flex-shrink-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : data?.versions.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No versions yet. Save the note to create a version.
              </div>
            ) : (
              <div className="py-1">
                {data?.versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => loadVersion(v.id)}
                    className={`w-full text-left px-3 py-2.5 text-xs hover:bg-accent transition-colors border-b border-border/50 ${
                      selectedVersion === v.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="font-medium">v{v.versionNumber}</div>
                    <div className="text-muted-foreground mt-0.5">{formatDate(v.createdAt)}</div>
                    {v.message && <div className="text-muted-foreground mt-0.5 truncate">{v.message}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-y-auto p-4">
            {previewContent !== null ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Preview</span>
                  <button
                    onClick={() => { if (selectedVersion) restoreMutation.mutate(selectedVersion); }}
                    disabled={restoreMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore this version
                  </button>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{previewContent}</pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select a version to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
