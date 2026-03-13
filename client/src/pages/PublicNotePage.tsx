import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { marked } from 'marked';
import { BookOpen } from 'lucide-react';

interface PublicNote {
  title: string;
  content: string;
  notebook: string;
  folder: string | null;
  tags: { name: string; color: string }[];
  updatedAt: string;
}

export default function PublicNotePage() {
  const { slug } = useParams<{ slug: string }>();
  const [note, setNote] = useState<PublicNote | null>(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error('Note not found or not public');
        return r.json();
      })
      .then(async (data: { note: PublicNote }) => {
        setNote(data.note);
        setHtml(await marked(data.note.content || ''));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{error || 'Note not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs text-muted-foreground mb-2">
            {note.notebook}{note.folder ? ` > ${note.folder}` : ''}
          </div>
          <h1 className="text-3xl font-bold text-foreground">{note.title}</h1>
          {note.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3">
              {note.tags.map(t => (
                <span
                  key={t.name}
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: t.color + '20', color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Last updated: {new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Content */}
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Footer */}
        <div className="mt-16 pt-4 border-t border-border text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Shared via NotesOrganizer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
