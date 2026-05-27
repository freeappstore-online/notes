import { useState, useEffect, useCallback, useRef, useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  type Note,
  type View,
  loadNotes,
  saveNotes,
  formatTime,
  filterAndSort,
  getChildren,
  getTrash,
  migrateNote,
  createNote as makeNote,
  TEMPLATES,
} from "./notes.ts";
import { BlockEditor, editorHtmlToMarkdown, markdownToEditorHtml } from "./components/BlockEditor.tsx";

const PAGE_ICONS = ["", "\u{1F4DD}", "\u{1F4CB}", "\u{1F4DA}", "\u{1F680}", "\u{2B50}", "\u{1F3AF}", "\u{1F4A1}", "\u{1F5C2}", "\u{1F30D}", "\u{2764}", "\u{1F525}"];

function useDebouncedEffect(fn: () => void, deps: unknown[], ms: number) {
  useEffect(() => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function useViewportHeight() {
  const [vh, setVh] = useState<string | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function update() {
      const fullHeight = window.innerHeight;
      const keyboardOpen = vv!.height < fullHeight * 0.85;
      setVh(keyboardOpen ? `${vv!.height}px` : null);
    }
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);
  return vh ?? "100dvh";
}

// ── Styles ─────────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  border: "none",
  borderRadius: "var(--radius-btn)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--color-accent)",
  color: "#fff",
  padding: "0.5rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 600,
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: "var(--color-muted)",
  padding: "0.375rem 0.75rem",
  fontSize: "0.75rem",
  border: "1px solid var(--color-line)",
};

const btnGhostMobile: React.CSSProperties = {
  ...btnGhost,
  minHeight: "2.75rem",
  minWidth: "2.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const tagPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.125rem 0.5rem",
  fontSize: "0.6875rem",
  borderRadius: "1rem",
  background: "var(--color-panel)",
  color: "var(--color-muted)",
  border: "1px solid var(--color-line)",
  fontFamily: "var(--font-body)",
  whiteSpace: "nowrap",
};

// ── Page Tree Item ────────────────────────────────────────────────────

function PageTreeItem({
  note,
  notes,
  activeId,
  depth,
  onOpen,
  onCreateChild,
}: {
  note: Note;
  notes: Note[];
  activeId: string | null;
  depth: number;
  onOpen: (id: string) => void;
  onCreateChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = getChildren(notes, note.id);
  const hasChildren = children.length > 0;
  const isActive = note.id === activeId;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.375rem 0.5rem",
          paddingLeft: `${0.5 + depth * 1}rem`,
          background: isActive ? "var(--color-paper)" : "transparent",
          cursor: "pointer",
          borderRadius: "0.375rem",
          margin: "0.0625rem 0.25rem",
          fontSize: "0.8125rem",
          color: "var(--color-ink)",
          fontFamily: "var(--font-body)",
          minHeight: "2rem",
        }}
        onClick={() => onOpen(note.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: "0.625rem",
              color: "var(--color-muted)",
              width: "1rem",
              flexShrink: 0,
              fontFamily: "var(--font-body)",
            }}
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <span style={{ width: "1rem", flexShrink: 0 }} />
        )}
        {note.pinned && (
          <span style={{ color: "var(--color-accent)", fontSize: "0.5rem" }}>&#9679;</span>
        )}
        <span
          style={{
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {note.icon ? `${note.icon} ` : ""}
          {note.title || "Untitled"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateChild(note.id);
          }}
          title="Add sub-page"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-muted)",
            fontSize: "0.875rem",
            padding: "0 0.25rem",
            opacity: 0.5,
            fontFamily: "var(--font-body)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
        >
          +
        </button>
      </div>
      {expanded &&
        children
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((child) => (
            <PageTreeItem
              key={child.id}
              note={child}
              notes={notes}
              activeId={activeId}
              depth={depth + 1}
              onOpen={onOpen}
              onCreateChild={onCreateChild}
            />
          ))}
    </div>
  );
}

// ── Template Picker ───────────────────────────────────────────────────

function TemplatePicker({ onPick }: { onPick: (key: string | null) => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "0.75rem",
        padding: "2rem",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <p
        style={{
          gridColumn: "1 / -1",
          fontSize: "1.125rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          color: "var(--color-ink)",
          margin: "0 0 0.5rem",
        }}
      >
        New page
      </p>
      {Object.entries(TEMPLATES).map(([key, t]) => (
        <button
          key={key}
          onClick={() => onPick(key === "blank" ? null : key)}
          style={{
            ...btnBase,
            background: "var(--color-panel)",
            border: "1px solid var(--color-line)",
            padding: "1rem",
            textAlign: "left",
            borderRadius: "var(--radius-card)",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>{t.icon || "\u{1F4DD}"}</span>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            {t.name}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Quick Switcher ─────────────────────────────────────────────────────

interface QuickSwitcherProps {
  query: string;
  setQuery: (q: string) => void;
  candidates: Note[];
  index: number;
  setIndex: (i: number) => void;
  onPick: (id: string) => void;
  onClose: () => void;
  pathOf: (n: Note) => string;
}

function QuickSwitcher({
  query,
  setQuery,
  candidates,
  index,
  setIndex,
  onPick,
  onClose,
  pathOf,
}: QuickSwitcherProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-qs-row="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function handleKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (candidates.length > 0) setIndex((index + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (candidates.length > 0) setIndex((index - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = candidates[index];
      if (pick) onPick(pick.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(2px)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(36rem, calc(100vw - 2rem))",
          background: "var(--color-bg)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.625rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={handleKey}
          placeholder="Jump to page..."
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "0.875rem 1rem",
            fontSize: "0.9375rem",
            color: "var(--color-ink)",
            borderBottom: "1px solid var(--color-line)",
          }}
        />
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {candidates.length === 0 ? (
            <div
              style={{
                padding: "1.5rem 1rem",
                color: "var(--color-muted)",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              No matches
            </div>
          ) : (
            candidates.map((n, i) => {
              const path = pathOf(n);
              return (
                <div
                  key={n.id}
                  data-qs-row={i}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onPick(n.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.5rem 0.875rem",
                    background: i === index ? "var(--color-panel)" : "transparent",
                    cursor: "pointer",
                    borderLeft:
                      i === index
                        ? "3px solid var(--color-accent)"
                        : "3px solid transparent",
                  }}
                >
                  <span style={{ fontSize: "1rem", width: "1.25rem", textAlign: "center" }}>
                    {n.icon || "\u{1F4C4}"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--color-ink)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.title || "Untitled"}
                    </div>
                    {path && (
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          color: "var(--color-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {path}
                      </div>
                    )}
                  </div>
                  {n.pinned && (
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>
                      pinned
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div
          style={{
            padding: "0.375rem 0.875rem",
            borderTop: "1px solid var(--color-line)",
            fontSize: "0.6875rem",
            color: "var(--color-muted)",
            display: "flex",
            gap: "1rem",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

// ── Trash view ─────────────────────────────────────────────────────────

interface TrashViewProps {
  items: Note[];
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmpty: () => void;
  onClose: () => void;
}

function TrashView({ items, onRestore, onPurge, onEmpty, onClose }: TrashViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid var(--color-line)",
          flexShrink: 0,
        }}
      >
        <button onClick={onClose} style={{ ...btnGhost }}>
          Back
        </button>
        <div style={{ flex: 1, fontWeight: 600, fontSize: "0.9375rem" }}>Trash</div>
        {items.length > 0 && (
          <button
            onClick={() => {
              if (confirm(`Permanently delete ${items.length} page(s)?`)) onEmpty();
            }}
            style={{ ...btnGhost, color: "var(--color-muted)" }}
            title="Empty the trash permanently"
          >
            Empty trash
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0.5rem 0" }}>
        {items.length === 0 ? (
          <p style={{ color: "var(--color-muted)", textAlign: "center", padding: "2rem 1rem" }}>
            Trash is empty
          </p>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 1rem",
                borderBottom: "1px solid var(--color-line)",
              }}
            >
              <span style={{ fontSize: "1.125rem", width: "1.5rem", textAlign: "center" }}>
                {n.icon || "\u{1F4C4}"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-ink)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.title || "Untitled"}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--color-muted)" }}>
                  deleted {n.deletedAt ? formatTime(n.deletedAt) : ""}
                </div>
              </div>
              <button onClick={() => onRestore(n.id)} style={{ ...btnGhost }}>
                Restore
              </button>
              <button
                onClick={() => {
                  if (confirm("Permanently delete this page?")) onPurge(n.id);
                }}
                style={{ ...btnGhost, color: "var(--color-muted)" }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────

export function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pendingParent, setPendingParent] = useState<string | null>(null);
  const [qsOpen, setQsOpen] = useState(false);
  const [qsQuery, setQsQuery] = useState("");
  const [qsIndex, setQsIndex] = useState(0);
  const [trashUndo, setTrashUndo] = useState<{ id: string; at: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const vh = useViewportHeight();

  useDebouncedEffect(
    () => {
      saveNotes(notes);
    },
    [notes],
    300,
  );

  useEffect(() => {
    if (!trashUndo) return;
    const id = setTimeout(() => setTrashUndo(null), 6000);
    return () => clearTimeout(id);
  }, [trashUndo]);


  const activeNote =
    view.kind === "editor" ? (notes.find((n) => n.id === view.noteId) ?? null) : null;
  const activeNoteId = activeNote?.id ?? null;

  const filtered = useMemo(() => filterAndSort(notes, search), [notes, search]);
  const rootFiltered = useMemo(
    () => filtered.filter((n) => n.parentId === null),
    [filtered],
  );
  const trashList = useMemo(() => getTrash(notes), [notes]);
  const trashCount = trashList.length;
  const breadcrumbs = useMemo(() => {
    if (!activeNote) return [];
    const trail: Note[] = [];
    let current: Note | undefined = activeNote;
    while (current?.parentId) {
      const parent = notes.find((n) => n.id === current!.parentId);
      if (!parent) break;
      trail.unshift(parent);
      current = parent;
    }
    return trail;
  }, [activeNote, notes]);

  const startCreateNote = useCallback(
    (parentId: string | null = null) => {
      setPendingParent(parentId);
      setShowTemplates(true);
    },
    [],
  );

  const finishCreateNote = useCallback(
    (template: string | null) => {
      const note = makeNote(pendingParent, template);
      setNotes((prev) => [note, ...prev]);
      setView({ kind: "editor", noteId: note.id });
      setSearch("");
      setTagInput("");
      setShowTemplates(false);
      setPendingParent(null);
    },
    [pendingParent],
  );

  const createQuickNote = useCallback((parentId: string | null = null) => {
    const note = makeNote(parentId);
    setNotes((prev) => [note, ...prev]);
    setView({ kind: "editor", noteId: note.id });
    setSearch("");
    setTagInput("");
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title, updatedAt: Date.now() } : n)),
    );
  }, []);

  const updateBody = useCallback((id: string, body: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, body, updatedAt: Date.now() } : n)),
    );
  }, []);

  const setIcon = useCallback((id: string, icon: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, icon } : n)));
  }, []);

  const exportMarkdown = useCallback(
    (note: Note) => {
      const md = `# ${note.title || "Untitled"}\n\n${editorHtmlToMarkdown(note.body)}`;
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(note.title || "untitled").replace(/[^a-zA-Z0-9-_ ]/g, "").trim()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  const exportAll = useCallback(() => {
    const payload = {
      app: "freenotes",
      version: 1,
      exportedAt: Date.now(),
      notes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `notes-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes]);

  const deleteNote = useCallback((id: string) => {
    const now = Date.now();
    setNotes((prev) => {
      const affected = new Set<string>();
      function collect(noteId: string) {
        affected.add(noteId);
        prev
          .filter((n) => n.parentId === noteId && n.deletedAt === null)
          .forEach((n) => collect(n.id));
      }
      collect(id);
      return prev.map((n) => (affected.has(n.id) ? { ...n, deletedAt: now } : n));
    });
    setView((prev) => (prev.kind === "editor" && prev.noteId === id ? { kind: "list" } : prev));
    setTrashUndo({ id, at: now });
  }, []);

  const restoreNote = useCallback((id: string) => {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || target.deletedAt === null) return prev;
      const ts = target.deletedAt;
      return prev.map((n) =>
        n.deletedAt === ts ? { ...n, deletedAt: null } : n,
      );
    });
  }, []);

  const purgeNote = useCallback((id: string) => {
    setNotes((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || target.deletedAt === null) return prev;
      const ts = target.deletedAt;
      return prev.filter((n) => n.deletedAt !== ts);
    });
  }, []);

  const emptyTrash = useCallback(() => {
    setNotes((prev) => prev.filter((n) => n.deletedAt === null));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  }, []);

  const duplicateNote = useCallback(
    (note: Note) => {
      const now = Date.now();
      const dup: Note = {
        ...note,
        id: crypto.randomUUID(),
        title: note.title ? `${note.title} (copy)` : "",
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => [dup, ...prev]);
      setView({ kind: "editor", noteId: dup.id });
    },
    [],
  );

  const importMarkdown = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const isJson = file.name.toLowerCase().endsWith(".json");
        if (isJson) {
          try {
            const parsed = JSON.parse(text);
            const raw = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.notes)
                ? parsed.notes
                : null;
            if (!raw) {
              alert("That JSON doesn't look like a notes backup.");
              return;
            }
            const imported = (raw as Record<string, unknown>[])
              .map(migrateNote)
              .map((n) => ({ ...n, id: crypto.randomUUID() }));
            const idMap = new Map<string, string>();
            (raw as Record<string, unknown>[]).forEach((src, i) => {
              const oldId = typeof src.id === "string" ? src.id : null;
              if (oldId && imported[i]) idMap.set(oldId, imported[i].id);
            });
            const remapped = imported.map((n) => ({
              ...n,
              parentId: n.parentId && idMap.get(n.parentId) ? idMap.get(n.parentId)! : null,
            }));
            setNotes((prev) => [...remapped, ...prev]);
            alert(`Imported ${remapped.length} page(s).`);
          } catch {
            alert("Could not parse JSON backup.");
          }
          return;
        }
        const lines = text.split("\n");
        let title = "";
        let bodyStart = 0;
        if (lines[0]?.startsWith("# ")) {
          title = lines[0].slice(2).trim();
          bodyStart = 1;
          while (lines[bodyStart] === "") bodyStart++;
        }
        const bodyMd = lines.slice(bodyStart).join("\n");
        const bodyHtml = markdownToEditorHtml(bodyMd);
        const now = Date.now();
        const note: Note = {
          id: crypto.randomUUID(),
          parentId: null,
          title,
          body: bodyHtml,
          pinned: false,
          tags: [],
          icon: "",
          template: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        setNotes((prev) => [note, ...prev]);
        setView({ kind: "editor", noteId: note.id });
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const addTag = useCallback((id: string, raw: string) => {
    const newTags = raw
      .split(",")
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);
    if (newTags.length === 0) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const deduped = newTags.filter((t) => !n.tags.includes(t));
        if (deduped.length === 0) return n;
        return { ...n, tags: [...n.tags, ...deduped], updatedAt: Date.now() };
      }),
    );
  }, []);

  const removeTag = useCallback((id: string, tag: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, tags: n.tags.filter((x) => x !== tag), updatedAt: Date.now() } : n,
      ),
    );
  }, []);

  const openNote = useCallback((id: string) => {
    setView({ kind: "editor", noteId: id });
    setTagInput("");
    setShowTemplates(false);
  }, []);

  const notePath = useCallback(
    (note: Note): string => {
      const parts: string[] = [];
      let cur: Note | undefined = note;
      const seen = new Set<string>();
      while (cur?.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        const parent = notes.find((n) => n.id === cur!.parentId);
        if (!parent) break;
        parts.unshift(parent.title || "Untitled");
        cur = parent;
      }
      return parts.join(" / ");
    },
    [notes],
  );

  const qsCandidates = useMemo<Note[]>(() => {
    const q = qsQuery.trim().toLowerCase();
    if (!q) {
      return [...notes]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        })
        .slice(0, 12);
    }
    const scored: { note: Note; score: number }[] = [];
    for (const n of notes) {
      const title = (n.title || "untitled").toLowerCase();
      const tags = n.tags.join(" ").toLowerCase();
      let score = 0;
      if (title === q) score += 100;
      else if (title.startsWith(q)) score += 50;
      else if (title.includes(q)) score += 25;
      if (tags.includes(q)) score += 10;
      if (n.body.toLowerCase().includes(q)) score += 1;
      if (score > 0) scored.push({ note: n, score });
    }
    scored.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
    return scored.slice(0, 20).map((s) => s.note);
  }, [notes, qsQuery]);

  useEffect(() => {
    if (qsIndex >= qsCandidates.length) setQsIndex(0);
  }, [qsCandidates, qsIndex]);

  const openFromSwitcher = useCallback(
    (id: string) => {
      setQsOpen(false);
      setQsQuery("");
      openNote(id);
    },
    [openNote],
  );

  const goBack = useCallback(() => {
    setNotes((prev) => prev.filter((n) => n.title || n.body));
    setView({ kind: "list" });
    setTagInput("");
    setShowTemplates(false);
  }, []);

  useEffect(() => {
    if (view.kind === "editor" && titleRef.current) {
      titleRef.current.focus();
    }
  }, [view]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────

  const activeNoteIdRef = useRef(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const searchRef = useRef(search);
  searchRef.current = search;
  const qsOpenRef = useRef(qsOpen);
  qsOpenRef.current = qsOpen;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (meta && (e.key === "k" || e.key === "p")) {
        e.preventDefault();
        setQsQuery("");
        setQsIndex(0);
        setQsOpen(true);
        return;
      }
      if (qsOpenRef.current) return;
      if (meta && e.key === "n") {
        e.preventDefault();
        createQuickNote();
      }
      if (meta && e.key === "Backspace" && activeNoteIdRef.current) {
        e.preventDefault();
        deleteNote(activeNoteIdRef.current);
      }
      if (meta && e.key === "f") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-search]");
        input?.focus();
      }
      if (e.key === "Escape" && !inInput) {
        if (searchRef.current) {
          setSearch("");
        } else {
          goBack();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createQuickNote, deleteNote, goBack]);

  // ── Sidebar page tree ──────────────────────────────────────────────

  function renderPageTree() {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem",
            borderBottom: "1px solid var(--color-line)",
          }}
        >
          <input
            type="text"
            data-search
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: "var(--color-paper)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-btn)",
              padding: "0.375rem 0.75rem",
              fontSize: "1rem",
              outline: "none",
              fontFamily: "var(--font-body)",
            }}
          />
          <button
            onClick={() => {
              setQsQuery("");
              setQsIndex(0);
              setQsOpen(true);
            }}
            className="hidden md:flex"
            title="Quick switch (⌘K)"
            style={{
              ...btnBase,
              background: "transparent",
              border: "1px solid var(--color-line)",
              color: "var(--color-muted)",
              padding: "0.25rem 0.5rem",
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
            }}
          >
            ⌘K
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0.25rem 0" }}>
          {search ? (
            filtered.length === 0 ? (
              <p
                style={{
                  color: "var(--color-muted)",
                  fontSize: "0.8125rem",
                  textAlign: "center",
                  padding: "2rem 1rem",
                }}
              >
                No matching pages
              </p>
            ) : (
              filtered.map((note) => (
                <div
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    color: "var(--color-ink)",
                    borderRadius: "0.375rem",
                    margin: "0.0625rem 0.25rem",
                    background:
                      note.id === activeNoteId ? "var(--color-paper)" : "transparent",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {note.icon ? `${note.icon} ` : ""}
                  {note.title || "Untitled"}
                </div>
              ))
            )
          ) : rootFiltered.length === 0 ? (
            <p
              style={{
                color: "var(--color-muted)",
                fontSize: "0.8125rem",
                textAlign: "center",
                padding: "2rem 1rem",
              }}
            >
              No pages yet
            </p>
          ) : (
            rootFiltered.map((note) => (
              <PageTreeItem
                key={note.id}
                note={note}
                notes={notes}
                activeId={activeNoteId}
                depth={0}
                onOpen={openNote}
                onCreateChild={createQuickNote}
              />
            ))
          )}
        </div>

        {trashCount > 0 && (
          <button
            onClick={() => setView({ kind: "trash" })}
            style={{
              ...btnBase,
              background: "transparent",
              border: "none",
              borderTop: "1px solid var(--color-line)",
              color: "var(--color-muted)",
              padding: "0.5rem 0.75rem",
              fontSize: "0.75rem",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            title="Open trash"
          >
            <span>🗑 Trash</span>
            <span style={{ fontSize: "0.6875rem" }}>{trashCount}</span>
          </button>
        )}
        <div style={{ padding: "0.5rem", borderTop: "1px solid var(--color-line)", display: "flex", gap: "0.375rem" }}>
          <button
            onClick={() => startCreateNote(null)}
            style={{
              ...btnBase,
              flex: 1,
              background: "var(--color-accent)",
              color: "#fff",
              padding: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            + New Page
          </button>
          <button
            onClick={importMarkdown}
            style={{
              ...btnBase,
              background: "transparent",
              border: "1px solid var(--color-line)",
              color: "var(--color-muted)",
              padding: "0.5rem 0.625rem",
              fontSize: "0.8125rem",
            }}
            title="Import a Markdown file"
          >
            Import
          </button>
          <button
            onClick={exportAll}
            style={{
              ...btnBase,
              background: "transparent",
              border: "1px solid var(--color-line)",
              color: "var(--color-muted)",
              padding: "0.5rem 0.625rem",
              fontSize: "0.8125rem",
            }}
            title="Download a JSON backup of every page"
          >
            Backup
          </button>
        </div>
      </div>
    );
  }

  // ── Editor panel ───────────────────────────────────────────────────

  const childNotes = activeNote ? getChildren(notes, activeNote.id) : [];

  const editorPanel = showTemplates ? (
    <TemplatePicker onPick={finishCreateNote} />
  ) : view.kind === "trash" ? (
    <TrashView
      items={trashList}
      onRestore={restoreNote}
      onPurge={purgeNote}
      onEmpty={emptyTrash}
      onClose={() => setView({ kind: "list" })}
    />
  ) : activeNote ? (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid var(--color-line)",
          flexShrink: 0,
        }}
      >
        <button onClick={goBack} className="md:hidden" style={{ ...btnGhostMobile }}>
          Back
        </button>

        {/* Breadcrumbs */}
        <div
          className="hidden md:flex"
          style={{
            alignItems: "center",
            gap: "0.25rem",
            flex: 1,
            overflow: "hidden",
            fontSize: "0.75rem",
            color: "var(--color-muted)",
          }}
        >
          {breadcrumbs.map((bc) => (
            <span key={bc.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <button
                onClick={() => openNote(bc.id)}
                style={{
                  ...btnBase,
                  background: "none",
                  color: "var(--color-muted)",
                  padding: "0.125rem 0.25rem",
                  fontSize: "0.75rem",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                {bc.title || "Untitled"}
              </button>
              <span>/</span>
            </span>
          ))}
          <span style={{ fontWeight: 500, color: "var(--color-ink)" }}>
            {activeNote.title || "Untitled"}
          </span>
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>
            {formatTime(activeNote.updatedAt)}
          </span>
        </div>

        <div style={{ marginLeft: "auto" }} className="md:hidden" />

        <button
          onClick={() => togglePin(activeNote.id)}
          title={activeNote.pinned ? "Unpin" : "Pin"}
          className="hidden md:flex"
          style={{
            ...btnGhost,
            color: activeNote.pinned ? "var(--color-accent)" : "var(--color-muted)",
            borderColor: activeNote.pinned ? "var(--color-accent)" : "var(--color-line)",
          }}
        >
          {activeNote.pinned ? "Pinned" : "Pin"}
        </button>
        <button
          onClick={() => togglePin(activeNote.id)}
          className="flex md:hidden"
          style={{
            ...btnGhostMobile,
            color: activeNote.pinned ? "var(--color-accent)" : "var(--color-muted)",
            borderColor: activeNote.pinned ? "var(--color-accent)" : "var(--color-line)",
          }}
        >
          {activeNote.pinned ? "Pinned" : "Pin"}
        </button>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowIconPicker((p) => !p)}
            className="hidden md:flex"
            style={btnGhost}
            title="Page icon"
          >
            {activeNote.icon || "Icon"}
          </button>
          <button
            onClick={() => setShowIconPicker((p) => !p)}
            className="flex md:hidden"
            style={btnGhostMobile}
            title="Page icon"
          >
            {activeNote.icon || "Icon"}
          </button>
          {showIconPicker && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "0.25rem",
                background: "var(--color-paper)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.5rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                padding: "0.5rem",
                zIndex: 50,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.25rem",
                minWidth: "160px",
              }}
            >
              {PAGE_ICONS.map((icon) => (
                <button
                  key={icon || "none"}
                  onClick={() => {
                    setIcon(activeNote.id, icon);
                    setShowIconPicker(false);
                  }}
                  style={{
                    ...btnBase,
                    background: activeNote.icon === icon ? "var(--color-panel)" : "transparent",
                    border: "1px solid transparent",
                    borderRadius: "0.375rem",
                    padding: "0.375rem",
                    fontSize: icon ? "1.125rem" : "0.625rem",
                    color: "var(--color-muted)",
                    minWidth: "2rem",
                    minHeight: "2rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {icon || "none"}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => duplicateNote(activeNote)}
          className="hidden md:flex"
          style={btnGhost}
          title="Duplicate page"
        >
          Duplicate
        </button>
        <button
          onClick={() => duplicateNote(activeNote)}
          className="flex md:hidden"
          style={btnGhostMobile}
          title="Duplicate page"
        >
          Copy
        </button>
        <button
          onClick={() => exportMarkdown(activeNote)}
          className="hidden md:flex"
          style={btnGhost}
          title="Export as Markdown"
        >
          Export
        </button>
        <button
          onClick={() => exportMarkdown(activeNote)}
          className="flex md:hidden"
          style={btnGhostMobile}
          title="Export as Markdown"
        >
          Export
        </button>
        <button
          onClick={() => deleteNote(activeNote.id)}
          className="hidden md:flex"
          style={btnGhost}
        >
          Delete
        </button>
        <button
          onClick={() => deleteNote(activeNote.id)}
          className="flex md:hidden"
          style={btnGhostMobile}
        >
          Delete
        </button>
      </div>

      {/* Tags */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 1rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-line)",
          minHeight: "2rem",
        }}
      >
        {activeNote.tags.map((t) => (
          <span key={t} style={tagPill}>
            {t}
            <button
              onClick={() => removeTag(activeNote.id, t)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-muted)",
                fontSize: "0.875rem",
                padding: "0.125rem",
                lineHeight: 1,
                fontFamily: "var(--font-body)",
                minWidth: "1.25rem",
                minHeight: "1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
              e.preventDefault();
              addTag(activeNote.id, tagInput);
              setTagInput("");
            }
            if (e.key === "Backspace" && !tagInput && activeNote.tags.length > 0) {
              removeTag(activeNote.id, activeNote.tags.at(-1)!);
            }
          }}
          placeholder={activeNote.tags.length === 0 ? "Add tags..." : ""}
          style={{
            flex: 1,
            minWidth: "4rem",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "1rem",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            padding: "0.125rem 0",
          }}
        />
      </div>

      {/* Title */}
      <input
        ref={titleRef}
        value={activeNote.title}
        onChange={(e) => updateTitle(activeNote.id, e.target.value)}
        placeholder="Untitled"
        style={{
          width: "100%",
          outline: "none",
          padding: "1rem 1rem 0.25rem",
          fontSize: "1.75rem",
          fontWeight: 800,
          lineHeight: 1.3,
          background: "transparent",
          color: "var(--color-ink)",
          border: "none",
          fontFamily: "var(--font-display)",
          userSelect: "text",
          WebkitUserSelect: "text",
          flexShrink: 0,
        }}
      />

      {/* Block editor */}
      <BlockEditor
        content={activeNote.body}
        onChange={(html) => updateBody(activeNote.id, html)}
      />

      {/* Sub-pages */}
      {childNotes.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--color-line)",
            padding: "0.75rem 1rem",
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: "0.6875rem",
              color: "var(--color-muted)",
              marginBottom: "0.375rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}
          >
            Sub-pages
          </p>
          {childNotes.map((child) => (
            <button
              key={child.id}
              onClick={() => openNote(child.id)}
              style={{
                ...btnBase,
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "var(--color-panel)",
                border: "1px solid var(--color-line)",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.75rem",
                marginBottom: "0.375rem",
                fontSize: "0.8125rem",
                color: "var(--color-ink)",
              }}
            >
              {child.icon ? `${child.icon} ` : ""}
              {child.title || "Untitled"}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--color-muted)", fontSize: "1rem", marginBottom: "0.75rem" }}>
          Select a page or create a new one
        </p>
        <button onClick={() => startCreateNote(null)} style={btnPrimary}>
          New Page
        </button>
        <p
          style={{
            color: "var(--color-muted)",
            fontSize: "0.6875rem",
            marginTop: "1.5rem",
            lineHeight: 1.6,
          }}
        >
          Cmd+N quick note &middot; Cmd+F search
        </p>
      </div>
    </div>
  );

  // ── Desktop Layout ─────────────────────────────────────────────────

  return (
    <>
      {qsOpen && (
        <QuickSwitcher
          query={qsQuery}
          setQuery={setQsQuery}
          candidates={qsCandidates}
          index={qsIndex}
          setIndex={setQsIndex}
          onPick={openFromSwitcher}
          onClose={() => setQsOpen(false)}
          pathOf={notePath}
        />
      )}
      {trashUndo && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "calc(1rem + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "var(--color-ink)",
            color: "var(--color-bg)",
            padding: "0.5rem 0.5rem 0.5rem 0.875rem",
            borderRadius: "0.5rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: "0.8125rem",
          }}
        >
          <span>Page moved to trash</span>
          <button
            onClick={() => {
              restoreNote(trashUndo.id);
              setTrashUndo(null);
            }}
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Undo
          </button>
        </div>
      )}
      {/* Desktop */}
      <div className="hidden md:flex" style={{ height: "100dvh" }}>
        <aside
          style={{
            width: "17rem",
            flexShrink: 0,
            borderRight: "1px solid var(--color-line)",
            background: "var(--color-panel)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            style={{
              padding: "1.25rem 1rem 0.75rem",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.125rem",
            }}
          >
            notes
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>{renderPageTree()}</div>
          <div style={{ padding: "0.75rem", fontSize: "0.6875rem", color: "var(--color-muted)" }}>
            <a
              href="https://freeappstore.online"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-muted)", textDecoration: "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Part of FreeAppStore
            </a>
          </div>
        </aside>
        <main style={{ flex: 1, overflow: "auto" }}>{editorPanel}</main>
      </div>

      {/* Mobile */}
      <div className="flex flex-col md:hidden" style={{ height: vh }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1rem",
            paddingTop: "env(safe-area-inset-top)",
            minHeight: "3.5rem",
            borderBottom: "1px solid var(--color-line)",
            background: "var(--color-panel)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>notes</span>
          {view.kind === "list" && !showTemplates && (
            <button
              onClick={() => startCreateNote(null)}
              style={{
                ...btnBase,
                background: "var(--color-accent)",
                color: "#fff",
                padding: "0.5rem 1rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                minHeight: "2.75rem",
              }}
            >
              + New
            </button>
          )}
        </header>
        <main style={{ flex: 1, overflow: "auto" }}>
          {showTemplates ? (
            <TemplatePicker onPick={finishCreateNote} />
          ) : view.kind === "list" ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {renderPageTree()}
              <div
                style={{
                  padding: "0.75rem",
                  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
                  textAlign: "center",
                  fontSize: "0.6875rem",
                  color: "var(--color-muted)",
                  flexShrink: 0,
                }}
              >
                <a
                  href="https://freeappstore.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--color-muted)", textDecoration: "none" }}
                >
                  Part of FreeAppStore
                </a>
              </div>
            </div>
          ) : (
            editorPanel
          )}
        </main>
      </div>
    </>
  );
}

export default App;
