import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6b7280', '#1e293b',
];

interface Props {
  type: string;
  id: string;
  name: string;
  color?: string;
  onClose: () => void;
}

export default function PropertiesModal({ type, id, name, color, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedColor, setSelectedColor] = useState(color || COLORS[0]);

  const updateColor = useMutation({
    mutationFn: (newColor: string) => {
      const endpoint = type === 'notebook' ? `/notebooks/${id}` : `/notes/${id}`;
      return api(endpoint, { method: 'PUT', body: JSON.stringify({ color: newColor }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success('Color updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    if (selectedColor !== color) {
      updateColor.mutate(selectedColor);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-medium text-sm">Properties</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Type</div>
            <div className="text-sm capitalize">{type}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Name</div>
            <div className="text-sm">{name}</div>
          </div>

          {/* Color picker (notebooks support color) */}
          {type === 'notebook' && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Color</div>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      selectedColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded hover:bg-accent transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
