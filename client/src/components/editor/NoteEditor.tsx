import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import TurndownService from 'turndown';
import { marked } from 'marked';
import EditorToolbar from './EditorToolbar';
import SplitEditor from './SplitEditor';
import TagPicker from '../tags/TagPicker';
import VersionHistory from '../history/VersionHistory';
import {
  ChevronRight, Save, Columns2, Eye, History, Download,
} from 'lucide-react';

const lowlight = createLowlight(common);

// HTML ↔ Markdown converters
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
// Override escape to not backslash-escape brackets in plain text
turndown.escape = (str: string) => {
  return str
    .replace(/\\/, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/^-/g, '\\-')
    .replace(/^\+ /g, '\\+ ')
    .replace(/^(=+)/g, '\\$1')
    .replace(/^(#{1,6}) /g, '\\$1 ')
    .replace(/`/g, '\\`')
    .replace(/^~~~/g, '\\~~~')
    .replace(/^>/g, '\\>');
};
// Preserve task list checkboxes
turndown.addRule('taskListItem', {
  filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem',
  replacement: (content, node) => {
    const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
    return `- [${checked ? 'x' : ' '}] ${content.trim()}\n`;
  },
});

function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';
  return turndown.turndown(html);
}

async function markdownToHtml(md: string): Promise<string> {
  if (!md) return '<p></p>';
  return await marked(md);
}

interface Props {
  noteId: string;
}

export default function NoteEditor({ noteId }: Props) {
  const queryClient = useQueryClient();
  const { editorMode, setEditorMode } = useAppStore();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [showVersions, setShowVersions] = useState(false);
  const [splitContent, setSplitContent] = useState('');

  // Fetch note data
  const { data, isLoading } = useQuery({
    queryKey: ['note', noteId],
    queryFn: () => api<{
      note: {
        id: string; title: string; isDirty: boolean;
        content: string; tags: { tag: { id: string; name: string; color: string } }[];
        notebook: { id: string; name: string };
        folder: { id: string; name: string; parentId: string | null } | null;
      };
      breadcrumb: { id: string; name: string; type: string }[];
      readonly?: boolean;
    }>(`/notes/${noteId}`),
  });

  const isReadonly = data?.readonly === true;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: '',
    editable: !isReadonly,
    onUpdate: ({ editor }) => {
      if (isReadonly) return;
      setIsDirty(true);
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);

      // Debounced auto-save draft — save as markdown
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDraft(htmlToMarkdown(editor.getHTML()));
      }, 2000);
    },
  });

  // Set content when note data loads
  useEffect(() => {
    if (data?.note && editor) {
      setTitle(data.note.title);
      setIsDirty(data.note.isDirty);
      const rawContent = data.note.content || '';
      // Content from server is markdown — convert to HTML for TipTap
      markdownToHtml(rawContent).then(html => {
        editor.commands.setContent(html || '<p></p>');
      });
      setSplitContent(rawContent);
      const text = editor.getText();
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }
  }, [data, editor]);

  // Draft auto-save
  const saveDraft = useCallback(async (content: string) => {
    try {
      await api(`/notes/${noteId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    } catch {
      // Silent fail for drafts
    }
  }, [noteId]);

  // Commit (explicit save)
  const commitMutation = useMutation({
    mutationFn: () => api(`/notes/${noteId}/commit`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      setIsDirty(false);
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
      toast.success('Saved');
    },
    onError: () => {
      setIsSaving(false);
      toast.error('Failed to save');
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setIsSaving(true);

    // Use content from the active editor mode, always save as markdown
    const content = editorMode === 'split' ? splitContent : htmlToMarkdown(editor.getHTML());

    // First save draft with current content, then commit
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await api(`/notes/${noteId}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });

    commitMutation.mutate();
  }, [editor, noteId, commitMutation]);

  // Handle split editor content changes
  const handleSplitChange = useCallback((content: string) => {
    setSplitContent(content);
    setIsDirty(true);
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(content);
    }, 2000);
  }, [saveDraft]);

  // Export
  const handleExport = useCallback(async (format: 'html' | 'md' | 'pdf') => {
    if (format === 'pdf') {
      // Client-side PDF generation
      try {
        const { default: html2canvas } = await import('html2canvas');
        const { default: jsPDF } = await import('jspdf');
        const editorEl = document.querySelector('.tiptap') as HTMLElement;
        if (!editorEl) { toast.error('Editor not found'); return; }
        const canvas = await html2canvas(editorEl);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${title || 'note'}.pdf`);
        toast.success('PDF exported');
      } catch {
        toast.error('PDF export failed');
      }
      return;
    }

    try {
      const res = await fetch(`/api/notes/${noteId}/export?format=${format}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'note'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  }, [noteId, title]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Title update
  const updateTitle = useMutation({
    mutationFn: (newTitle: string) =>
      api(`/notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notebooks'] });
    },
  });

  const handleTitleBlur = () => {
    if (title.trim() && title !== data?.note.title) {
      updateTitle.mutate(title.trim());
    }
  };

  // Image paste handler
  useEffect(() => {
    if (!editor) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const formData = new FormData();
          formData.append('file', file);

          try {
            const result = await api<{ url: string }>(`/notes/${noteId}/images`, {
              method: 'POST',
              body: formData,
            });
            editor.chain().focus().setImage({ src: result.url }).run();
          } catch {
            toast.error('Failed to upload image');
          }
        }
      }
    };

    const editorEl = editor.view.dom;
    editorEl.addEventListener('paste', handlePaste);
    return () => editorEl.removeEventListener('paste', handlePaste);
  }, [editor, noteId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      {data?.breadcrumb && (
        <div className="flex items-center gap-1 px-4 py-1.5 text-xs text-muted-foreground border-b border-border bg-muted/30">
          {data.breadcrumb.map((item, idx) => (
            <span key={item.id} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="w-3 h-3" />}
              <span className="hover:text-foreground cursor-pointer transition-colors">{item.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Note header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        {isReadonly ? (
          <div className="flex-1 text-lg font-semibold">{title}</div>
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="flex-1 text-lg font-semibold bg-transparent outline-none"
            placeholder="Note title"
          />
        )}

        {isReadonly ? (
          <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground">Read only</span>
        ) : (
        <div className="flex items-center gap-1">
          {/* Export dropdown */}
          <div className="relative group">
            <button className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground" title="Export">
              <Download className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px] z-50">
              <button onClick={() => handleExport('md')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">Markdown (.md)</button>
              <button onClick={() => handleExport('html')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">HTML (.html)</button>
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors">PDF (.pdf)</button>
            </div>
          </div>

          {/* Version history */}
          <button
            onClick={() => setShowVersions(true)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
            title="Version history"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Editor mode toggle */}
          <button
            onClick={async () => {
              if (editor) {
                if (editorMode === 'wysiwyg') {
                  // Switching TO split: convert TipTap HTML → Markdown
                  setSplitContent(htmlToMarkdown(editor.getHTML()));
                } else {
                  // Switching TO wysiwyg: convert Markdown → HTML into TipTap
                  const html = await markdownToHtml(splitContent);
                  editor.commands.setContent(html);
                }
              }
              setEditorMode(editorMode === 'wysiwyg' ? 'split' : 'wysiwyg');
            }}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
            title={editorMode === 'wysiwyg' ? 'Switch to split view' : 'Switch to WYSIWYG'}
          >
            {editorMode === 'wysiwyg' ? <Columns2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isDirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        )}
      </div>

      {/* Tags */}
      {data?.note && !isReadonly && (
        <div className="px-4 py-1.5 border-b border-border">
          <TagPicker noteId={noteId} noteTags={data.note.tags} />
        </div>
      )}

      {/* Toolbar (WYSIWYG mode only, not in readonly) */}
      {editor && editorMode === 'wysiwyg' && !isReadonly && <EditorToolbar editor={editor} />}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {editorMode === 'wysiwyg' ? (
          editor && (
            <EditorContent
              editor={editor}
              className="prose prose-sm dark:prose-invert max-w-none"
            />
          )
        ) : (
          <SplitEditor content={splitContent} onChange={handleSplitChange} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-border text-xs text-muted-foreground">
        <span>{wordCount} words</span>
        <div className="flex items-center gap-3">
          <span className="opacity-60">{editorMode === 'wysiwyg' ? 'WYSIWYG' : 'Split'}</span>
          <span className={isDirty ? 'text-yellow-500' : 'text-green-500'}>
            {isDirty ? '● Draft' : '✓ Saved'}
          </span>
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <VersionHistory noteId={noteId} onClose={() => setShowVersions(false)} />
      )}
    </div>
  );
}
