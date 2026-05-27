import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import { useEffect, useRef } from "react";

interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: { HTMLAttributes: { class: "code-block" } },
  }),
  Placeholder.configure({ placeholder: "Start writing, use / for commands..." }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
  Link.configure({ openOnClick: false }),
  Typography,
];

export function BlockEditor({ content, onChange, editable = true }: BlockEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        style={{ flex: 1, overflow: "auto", padding: "0.5rem 1rem 1rem" }}
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--color-accent)" : "var(--color-panel)",
    color: active ? "#fff" : "var(--color-ink)",
    border: "1px solid var(--color-line)",
    borderRadius: "0.375rem",
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    minWidth: "1.75rem",
    minHeight: "1.75rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const sep: React.CSSProperties = {
    width: "1px",
    height: "1.25rem",
    background: "var(--color-line)",
    margin: "0 0.125rem",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.375rem 1rem",
        borderBottom: "1px solid var(--color-line)",
        overflowX: "auto",
        flexShrink: 0,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        style={btnStyle(editor.isActive("heading", { level: 1 }))}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        style={btnStyle(editor.isActive("heading", { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        style={btnStyle(editor.isActive("heading", { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>
      <div style={sep} />
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={btnStyle(editor.isActive("bold"))}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={btnStyle(editor.isActive("italic"))}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        style={btnStyle(editor.isActive("strike"))}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        style={btnStyle(editor.isActive("highlight"))}
        title="Highlight"
      >
        Hi
      </button>
      <div style={sep} />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        style={btnStyle(editor.isActive("bulletList"))}
        title="Bullet list"
      >
        &#8226;
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        style={btnStyle(editor.isActive("orderedList"))}
        title="Numbered list"
      >
        1.
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        style={btnStyle(editor.isActive("taskList"))}
        title="Task list"
      >
        &#9745;
      </button>
      <div style={sep} />
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        style={btnStyle(editor.isActive("codeBlock"))}
        title="Code block"
      >
        {"</>"}
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        style={btnStyle(editor.isActive("blockquote"))}
        title="Quote"
      >
        &ldquo;
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        style={btnStyle(false)}
        title="Divider"
      >
        &#8212;
      </button>
    </div>
  );
}
