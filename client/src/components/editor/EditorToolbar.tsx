import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, Table, Link, Image,
  Undo, Redo, CodeSquare,
} from 'lucide-react';

interface Props {
  editor: Editor;
}

export default function EditorToolbar({ editor }: Props) {
  const btnClass = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${
      active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border flex-wrap">
      {/* History */}
      <button onClick={() => editor.chain().focus().undo().run()} className={btnClass(false)} title="Undo (Ctrl+Z)">
        <Undo className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} className={btnClass(false)} title="Redo (Ctrl+Shift+Z)">
        <Redo className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Text formatting */}
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Bold (Ctrl+B)">
        <Bold className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italic (Ctrl+I)">
        <Italic className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Strikethrough">
        <Strikethrough className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleCode().run()} className={btnClass(editor.isActive('code'))} title="Inline code">
        <Code className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Headings */}
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1">
        <Heading1 className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2">
        <Heading2 className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3">
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Bullet list">
        <List className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Numbered list">
        <ListOrdered className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={btnClass(editor.isActive('taskList'))} title="Checklist">
        <CheckSquare className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Blocks */}
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Blockquote">
        <Quote className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="Code block">
        <CodeSquare className="w-4 h-4" />
      </button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnClass(false)} title="Horizontal rule">
        <Minus className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Table */}
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass(editor.isActive('table'))}
        title="Insert table"
      >
        <Table className="w-4 h-4" />
      </button>

      {/* Link */}
      <button
        onClick={() => {
          const url = prompt('Enter URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={btnClass(editor.isActive('link'))}
        title="Insert link"
      >
        <Link className="w-4 h-4" />
      </button>

      {/* Image */}
      <button
        onClick={() => {
          const url = prompt('Enter image URL:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        className={btnClass(false)}
        title="Insert image (or paste from clipboard)"
      >
        <Image className="w-4 h-4" />
      </button>
    </div>
  );
}
