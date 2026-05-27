import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import { useEffect, useRef, useState, useCallback } from "react";

interface BlockEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

const SLASH_COMMANDS = [
  { label: "Heading 1", key: "h1", run: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: "Heading 2", key: "h2", run: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Heading 3", key: "h3", run: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Bullet List", key: "bullet", run: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered List", key: "number", run: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: "Task List", key: "task", run: (e: Editor) => e.chain().focus().toggleTaskList().run() },
  { label: "Code Block", key: "code", run: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { label: "Quote", key: "quote", run: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: "Divider", key: "divider", run: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
];

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: { HTMLAttributes: { class: "code-block" } },
  }),
  Placeholder.configure({ placeholder: "Start writing, type / for commands..." }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight,
  Link.configure({ openOnClick: false }),
  Typography,
];

export function BlockEditor({ content, onChange, editable = true }: BlockEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [wordCount, setWordCount] = useState(0);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const slashStartPos = useRef<number | null>(null);

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getHTML());
      const text = e.state.doc.textContent;
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
      const text = editor.state.doc.textContent;
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }
  }, [content, editor]);

  const filteredCommands = slashFilter
    ? SLASH_COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
          c.key.includes(slashFilter.toLowerCase()),
      )
    : SLASH_COMMANDS;

  const executeSlashCommand = useCallback(
    (index: number) => {
      if (!editor || !filteredCommands[index]) return;
      if (slashStartPos.current !== null) {
        const from = slashStartPos.current;
        const to = editor.state.selection.from;
        editor.chain().focus().deleteRange({ from, to }).run();
      }
      filteredCommands[index].run(editor);
      setSlashOpen(false);
      setSlashFilter("");
      slashStartPos.current = null;
    },
    [editor, filteredCommands],
  );

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (slashOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % filteredCommands.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          executeSlashCommand(slashIndex);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          setSlashFilter("");
          slashStartPos.current = null;
        }
      }
    };

    const handleTransaction = () => {
      if (!slashOpen) return;
      const { from } = editor.state.selection;
      if (slashStartPos.current === null) return;
      const text = editor.state.doc.textBetween(slashStartPos.current, from, "");
      if (text.includes("\n") || text.includes(" ")) {
        setSlashOpen(false);
        setSlashFilter("");
        slashStartPos.current = null;
      } else {
        setSlashFilter(text);
        setSlashIndex(0);
      }
    };

    const handleInput = () => {
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from, "");
      if (textBefore === "/") {
        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();
        setSlashPos({
          top: coords.bottom - editorRect.top,
          left: coords.left - editorRect.left,
        });
        setSlashOpen(true);
        setSlashFilter("");
        setSlashIndex(0);
        slashStartPos.current = from - 1;
      }
    };

    editor.on("transaction", handleTransaction);
    editor.view.dom.addEventListener("input", handleInput);
    editor.view.dom.addEventListener("keydown", handleKeyDown);

    return () => {
      editor.off("transaction", handleTransaction);
      editor.view.dom.removeEventListener("input", handleInput);
      editor.view.dom.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, slashOpen, slashIndex, filteredCommands, executeSlashCommand]);

  if (!editor) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {editable && <Toolbar editor={editor} />}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        <EditorContent
          editor={editor}
          style={{ padding: "0.5rem 1rem 1rem", minHeight: "100%" }}
        />
        {slashOpen && slashPos && filteredCommands.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: slashPos.top + 4,
              left: slashPos.left,
              background: "var(--color-paper)",
              border: "1px solid var(--color-line)",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              padding: "0.25rem",
              zIndex: 50,
              minWidth: "180px",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  executeSlashCommand(i);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8125rem",
                  fontFamily: "var(--font-body)",
                  background: i === slashIndex ? "var(--color-panel)" : "transparent",
                  color: "var(--color-ink)",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {editable && (
        <div
          style={{
            padding: "0.25rem 1rem",
            fontSize: "0.6875rem",
            color: "var(--color-muted)",
            borderTop: "1px solid var(--color-line)",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
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

  const disabledBtn: React.CSSProperties = {
    ...btnStyle(false),
    opacity: 0.35,
    cursor: "default",
  };

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
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        style={editor.can().undo() ? btnStyle(false) : disabledBtn}
        title="Undo (Cmd+Z)"
      >
        &#x21A9;
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        style={editor.can().redo() ? btnStyle(false) : disabledBtn}
        title="Redo (Cmd+Shift+Z)"
      >
        &#x21AA;
      </button>
      <div style={sep} />
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
        title="Bold (Cmd+B)"
      >
        <strong>B</strong>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={btnStyle(editor.isActive("italic"))}
        title="Italic (Cmd+I)"
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

export function editorHtmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return nodeToMd(div).trim();
}

export function markdownToEditorHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const at = (n: number): string => lines[n] ?? "";
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = at(i);

    if (line.trim() === "") { i++; continue; }

    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !at(i).startsWith("```")) { buf.push(at(i)); i++; }
      if (i < lines.length) i++;
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${inlineMd(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && at(i).startsWith("> ")) {
        buf.push(at(i).slice(2));
        i++;
      }
      out.push(`<blockquote><p>${buf.map(inlineMd).join("<br>")}</p></blockquote>`);
      continue;
    }

    if (/^- \[[ xX]\] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(at(i))) {
        const cur = at(i);
        const checked = /^- \[[xX]\] /.test(cur);
        const text = cur.replace(/^- \[[ xX]\] /, "");
        items.push(`<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? " checked" : ""}><span></span></label><div><p>${inlineMd(text)}</p></div></li>`);
        i++;
      }
      out.push(`<ul data-type="taskList">${items.join("")}</ul>`);
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(at(i))) {
        items.push(`<li><p>${inlineMd(at(i).slice(2))}</p></li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(at(i))) {
        items.push(`<li><p>${inlineMd(at(i).replace(/^\d+\. /, ""))}</p></li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const buf: string[] = [line];
    i++;
    while (i < lines.length && at(i).trim() !== "" && !isBlockStart(at(i))) {
      buf.push(at(i));
      i++;
    }
    out.push(`<p>${buf.map(inlineMd).join("<br>")}</p>`);
  }

  return out.join("");
}

function isBlockStart(line: string): boolean {
  return /^#{1,3} /.test(line)
    || line.startsWith("```")
    || line.startsWith("> ")
    || /^[-*] /.test(line)
    || /^\d+\. /.test(line)
    || /^(---|\*\*\*|___)\s*$/.test(line);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  t = t.replace(/==([^=]+)==/g, "<mark>$1</mark>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";

  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = () => Array.from(el.childNodes).map(nodeToMd).join("");

  switch (tag) {
    case "h1": return `# ${children()}\n\n`;
    case "h2": return `## ${children()}\n\n`;
    case "h3": return `### ${children()}\n\n`;
    case "p": return `${children()}\n\n`;
    case "br": return "\n";
    case "strong": case "b": return `**${children()}**`;
    case "em": case "i": return `*${children()}*`;
    case "s": case "del": return `~~${children()}~~`;
    case "code": return el.parentElement?.tagName === "PRE" ? children() : `\`${children()}\``;
    case "pre": return `\`\`\`\n${children()}\n\`\`\`\n\n`;
    case "blockquote": return children().split("\n").filter(Boolean).map((l) => `> ${l}`).join("\n") + "\n\n";
    case "hr": return "---\n\n";
    case "a": return `[${children()}](${el.getAttribute("href") ?? ""})`;
    case "mark": return `==${children()}==`;
    case "ul": {
      const isTask = el.getAttribute("data-type") === "taskList";
      return Array.from(el.children).map((li) => {
        if (isTask) {
          const checked = li.getAttribute("data-checked") === "true";
          const text = Array.from(li.childNodes).map(nodeToMd).join("").trim();
          return `- [${checked ? "x" : " "}] ${text}\n`;
        }
        return `- ${nodeToMd(li).trim()}\n`;
      }).join("") + "\n";
    }
    case "ol":
      return Array.from(el.children).map((li, i) =>
        `${i + 1}. ${nodeToMd(li).trim()}\n`
      ).join("") + "\n";
    case "li": return children();
    default: return children();
  }
}
