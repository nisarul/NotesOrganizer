import { useEffect, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';
import { marked } from 'marked';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export default function SplitEditor({ content, onChange }: Props) {
  const { theme } = useTheme();
  const [editorEl, setEditorEl] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState('');

  // Render preview
  useEffect(() => {
    const render = async () => {
      const html = await marked(content || '');
      setPreview(html);
    };
    render();
  }, [content]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorEl) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const extensions = [
      basicSetup,
      markdown(),
      updateListener,
      EditorView.lineWrapping,
      ...(theme === 'dark' ? [oneDark] : []),
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const editorView = new EditorView({
      state,
      parent: editorEl,
    });

    return () => {
      editorView.destroy();
    };
    // Only re-create on mount and theme change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorEl, theme]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Raw markdown editor */}
      <div className="w-1/2 border-r border-border overflow-auto">
        <div
          ref={setEditorEl}
          className="h-full min-h-[300px] text-sm [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:overflow-auto"
        />
      </div>
      {/* Preview */}
      <div className="w-1/2 overflow-auto p-4">
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </div>
    </div>
  );
}
