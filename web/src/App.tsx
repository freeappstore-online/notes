import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  type Note,
  type View,
  loadNotes,
  saveNotes,
  formatTime,
  filterAndSort,
  getChildren,
  createNote as makeNote,
  TEMPLATES,
} from "./notes.ts";
import { BlockEditor } from "./components/BlockEditor.tsx";

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

// ── App ────────────────────────────────────────────────────────────────

export function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingParent, setPendingParent] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const vh = useViewportHeight();

  useDebouncedEffect(
    () => {
      saveNotes(notes);
    },
    [notes],
    300,
  );

  const activeNote =
    view.kind === "editor" ? (notes.find((n) => n.id === view.noteId) ?? null) : null;
  const activeNoteId = activeNote?.id ?? null;

  const filtered = useMemo(() => filterAndSort(notes, search), [notes, search]);
  const rootFiltered = useMemo(
    () => filtered.filter((n) => n.parentId === null),
    [filtered],
  );
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

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const toRemove = new Set<string>();
      function collect(noteId: string) {
        toRemove.add(noteId);
        prev.filter((n) => n.parentId === noteId).forEach((n) => collect(n.id));
      }
      collect(id);
      return prev.filter((n) => !toRemove.has(n.id));
    });
    setView((prev) => (prev.kind === "editor" && prev.noteId === id ? { kind: "list" } : prev));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

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

        <div style={{ padding: "0.5rem", borderTop: "1px solid var(--color-line)" }}>
          <button
            onClick={() => startCreateNote(null)}
            style={{
              ...btnBase,
              width: "100%",
              background: "var(--color-accent)",
              color: "#fff",
              padding: "0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            + New Page
          </button>
        </div>
      </div>
    );
  }

  // ── Editor panel ───────────────────────────────────────────────────

  const childNotes = activeNote ? getChildren(notes, activeNote.id) : [];

  const editorPanel = showTemplates ? (
    <TemplatePicker onPick={finishCreateNote} />
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
