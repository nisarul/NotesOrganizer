import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Filter, X, Star, Clock } from 'lucide-react';

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface Props {
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export default function FilterDropdown({ activeFilter, onFilterChange }: Props) {
  const [open, setOpen] = useState(false);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => api<{ tags: TagData[] }>('/tags'),
    enabled: open,
  });

  const handleSelect = (filter: string | null) => {
    onFilterChange(filter);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded-md transition-colors ${activeFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
        title="Filter notes"
      >
        <Filter className="w-4 h-4" />
      </button>

      {activeFilter && (
        <button
          onClick={() => handleSelect(null)}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={() => handleSelect(null)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${!activeFilter ? 'text-primary font-medium' : ''}`}
          >
            All Notes
          </button>
          <div className="border-t border-border my-1" />
          <button
            onClick={() => handleSelect('favorites')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${activeFilter === 'favorites' ? 'text-primary font-medium' : ''}`}
          >
            <Star className="w-3.5 h-3.5" />
            Favorites
          </button>
          <button
            onClick={() => handleSelect('recent')}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${activeFilter === 'recent' ? 'text-primary font-medium' : ''}`}
          >
            <Clock className="w-3.5 h-3.5" />
            Recent
          </button>

          {tagsData?.tags && tagsData.tags.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-xs text-muted-foreground font-medium">Tags</div>
              {tagsData.tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleSelect(`tag:${tag.name}`)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${activeFilter === `tag:${tag.name}` ? 'text-primary font-medium' : ''}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
