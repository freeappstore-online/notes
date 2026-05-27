import { useState, useEffect, useCallback, useRef } from "react";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

// ── Types ──────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

type View = { kind: "list" } | { kind: "editor"; noteId: string };

// ── Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = "notes_data";

function migrateNote(n: Record<string, unknown>): Note {
  return {
    id: (n.id as string) ?? crypto.randomUUID(),
    title: (n.title as string) ?? "",
    body: (n.body as string) ?? "",
    pinned: (n.pinned as boolean) ?? false,
    tags: Array.isArray(n.tags) ? (n.tags as string[]) : [],
    createdAt: (n.createdAt as number) ?? Date.now(),
    updatedAt: (n.updatedAt as number) ?? Date.now(),
  };
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>[]).map(migrateNote) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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

// ── Swipeable Note Item ───────────────────────────────────────────────

function SwipeableNoteItem({
  note,
  isActive,
  onOpen,
  onDelete,
}: {
  note: Note;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const locked = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    locked.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;
    if (!locked.current && Math.abs(dy) > Math.abs(dx)) {
      locked.current = true;
    }
    if (!locked.current && dx < 0) {
      setOffsetX(Math.max(dx, -100));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX < -60) {
      onDelete();
    }
    setOffsetX(0);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "100px",
          background: "#d94040",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "0.8125rem",
          fontWeight: 600,
          fontFamily: "var(--font-body)",
        }}
      >
        Delete
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => offsetX === 0 && onOpen()}
        style={{
          position: "relative",
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? "transform 0.2s ease" : "none",
          background: "var(--color-paper)",
          padding: "0.875rem 1rem",
          borderBottom: "1px solid var(--color-line)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          textAlign: "left",
        }}
      >
        <NoteItemContent note={note} isActive={isActive} />
      </div>
    </div>
  );
}

function NoteItemContent({ note, isActive: _ }: { note: Note; isActive: boolean }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--color-ink)",
        }}
      >
        {note.pinned && (
          <span style={{ color: "var(--color-accent)", fontSize: "0.75rem", flexShrink: 0 }}>
            &#9679;
          </span>
        )}
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {note.title || "Untitled"}
        </span>
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-muted)",
          marginTop: "0.125rem",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formatTime(note.updatedAt)}
        {note.body && (
          <span style={{ marginLeft: "0.5rem" }}>
            {note.body.slice(0, 40).replace(/\n/g, " ")}
          </span>
        )}
      </div>
      {note.tags.length > 0 && (
        <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
          {note.tags.map((t) => (
            <span key={t} style={{ ...tagPill, padding: "0 0.375rem", fontSize: "0.625rem" }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ── App ────────────────────────────────────────────────────────────────

export function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const activeNote =
    view.kind === "editor" ? (notes.find((n) => n.id === view.noteId) ?? null) : null;

  const filtered = notes
    .filter((n) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  const createNote = useCallback(() => {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      pinned: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setView({ kind: "editor", noteId: note.id });
    setSearch("");
    setPreview(false);
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

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (view.kind === "editor" && view.noteId === id) {
        setView({ kind: "list" });
      }
    },
    [view],
  );

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n)),
    );
  }, []);

  const addTag = useCallback((id: string, tag: string) => {
    const t = tag.toLowerCase().trim();
    if (!t) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id && !n.tags.includes(t)
          ? { ...n, tags: [...n.tags, t], updatedAt: Date.now() }
          : n,
      ),
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
    setPreview(false);
    setTagInput("");
  }, []);

  const goBack = useCallback(() => {
    setView({ kind: "list" });
    setPreview(false);
    setTagInput("");
  }, []);

  useEffect(() => {
    if (view.kind === "editor" && titleRef.current) {
      titleRef.current.focus();
    }
  }, [view]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "n") {
        e.preventDefault();
        createNote();
      }
      if (meta && e.key === "Backspace" && activeNote) {
        e.preventDefault();
        deleteNote(activeNote.id);
      }
      if (meta && e.key === "f") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-search]");
        input?.focus();
      }
      if (meta && e.key === "e" && activeNote) {
        e.preventDefault();
        setPreview((p) => !p);
      }
      if (e.key === "Escape") {
        if (search) {
          setSearch("");
        } else if (view.kind === "editor") {
          goBack();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNote, view, search, createNote, deleteNote, goBack]);

  // ── Note list ──────────────────────────────────────────────────────

  function renderNoteList(mobile: boolean) {
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
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: mobile ? "var(--color-panel)" : "var(--color-paper)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-btn)",
              padding: "0.375rem 0.75rem",
              fontSize: "0.875rem",
              outline: "none",
              fontFamily: "var(--font-body)",
            }}
          />
          {!mobile && (
            <button
              onClick={createNote}
              title="New note"
              style={{
                ...btnBase,
                width: "2rem",
                height: "2rem",
                background: "var(--color-accent)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "1.125rem",
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              +
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <p
              style={{
                color: "var(--color-muted)",
                fontSize: "0.875rem",
                textAlign: "center",
                padding: mobile ? "3rem 1rem" : "2rem 1rem",
              }}
            >
              {search
                ? "No matching notes"
                : mobile
                  ? "No notes yet — tap + New to start"
                  : "No notes yet"}
            </p>
          )}
          {mobile
            ? filtered.map((note) => (
                <SwipeableNoteItem
                  key={note.id}
                  note={note}
                  isActive={view.kind === "editor" && view.noteId === note.id}
                  onOpen={() => openNote(note.id)}
                  onDelete={() => deleteNote(note.id)}
                />
              ))
            : filtered.map((note) => (
                <button
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    background:
                      view.kind === "editor" && view.noteId === note.id
                        ? "var(--color-paper)"
                        : "transparent",
                    border: "none",
                    borderBlockEnd: "1px solid var(--color-line)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <NoteItemContent
                    note={note}
                    isActive={view.kind === "editor" && view.noteId === note.id}
                  />
                </button>
              ))}
        </div>
      </div>
    );
  }

  // ── Editor panel ───────────────────────────────────────────────────

  const editorPanel = activeNote ? (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--color-line)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button onClick={goBack} className="md:hidden" style={{ ...btnGhost, marginRight: "auto" }}>
          Back
        </button>
        <span
          className="hidden md:inline"
          style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginRight: "auto" }}
        >
          {formatTime(activeNote.updatedAt)}
        </span>
        <button
          onClick={() => togglePin(activeNote.id)}
          title={activeNote.pinned ? "Unpin" : "Pin"}
          style={{
            ...btnGhost,
            color: activeNote.pinned ? "var(--color-accent)" : "var(--color-muted)",
            borderColor: activeNote.pinned ? "var(--color-accent)" : "var(--color-line)",
          }}
        >
          {activeNote.pinned ? "Pinned" : "Pin"}
        </button>
        <button
          onClick={() => setPreview((p) => !p)}
          title="Toggle preview (Cmd+E)"
          style={{
            ...btnGhost,
            color: preview ? "var(--color-accent)" : "var(--color-muted)",
            borderColor: preview ? "var(--color-accent)" : "var(--color-line)",
          }}
        >
          {preview ? "Edit" : "Preview"}
        </button>
        <button onClick={() => deleteNote(activeNote.id)} style={btnGhost}>
          Delete
        </button>
      </div>

      {/* Tags */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.5rem 1.5rem",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--color-line)",
          minHeight: "2.25rem",
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
                fontSize: "0.75rem",
                padding: 0,
                lineHeight: 1,
                fontFamily: "var(--font-body)",
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
            fontSize: "0.6875rem",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            padding: "0.125rem 0",
          }}
        />
      </div>

      {/* Content */}
      {preview ? (
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              lineHeight: 1.4,
              margin: "0 0 0.75rem",
              fontFamily: "var(--font-body)",
              color: "var(--color-ink)",
            }}
          >
            {activeNote.title || "Untitled"}
          </h1>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: marked.parse(activeNote.body) as string }}
          />
        </div>
      ) : (
        <>
          <input
            ref={titleRef}
            value={activeNote.title}
            onChange={(e) => updateTitle(activeNote.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                bodyRef.current?.focus();
              }
            }}
            placeholder="Title"
            style={{
              width: "100%",
              outline: "none",
              padding: "1.5rem 1.5rem 0.25rem",
              fontSize: "1.25rem",
              fontWeight: 700,
              lineHeight: 1.4,
              background: "transparent",
              color: "var(--color-ink)",
              border: "none",
              fontFamily: "var(--font-body)",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          />
          <textarea
            ref={bodyRef}
            value={activeNote.body}
            onChange={(e) => updateBody(activeNote.id, e.target.value)}
            placeholder="Start writing... (Markdown supported)"
            style={{
              flex: 1,
              width: "100%",
              resize: "none",
              outline: "none",
              padding: "0.25rem 1.5rem 1.5rem",
              fontSize: "1rem",
              lineHeight: 1.7,
              background: "transparent",
              color: "var(--color-ink)",
              border: "none",
              fontFamily: "var(--font-body)",
              userSelect: "text",
              WebkitUserSelect: "text",
            }}
          />
        </>
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
          Select a note or create a new one
        </p>
        <button onClick={createNote} style={btnPrimary}>
          New Note
        </button>
        <p
          style={{
            color: "var(--color-muted)",
            fontSize: "0.6875rem",
            marginTop: "1.5rem",
            lineHeight: 1.6,
          }}
        >
          Cmd+N new &middot; Cmd+F search &middot; Cmd+E preview
        </p>
      </div>
    </div>
  );

  // ── Desktop Layout ─────────────────────────────────────────────────

  const desktopLayout = (
    <div className="hidden md:flex" style={{ height: "100vh" }}>
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
            padding: "1.5rem",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.125rem",
          }}
        >
          notes
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>{renderNoteList(false)}</div>
        <div style={{ padding: "1rem", fontSize: "0.75rem", color: "var(--color-muted)" }}>
          <a
            href="https://freeappstore.online"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-muted)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Part of FreeAppStore — free forever
          </a>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: "auto" }}>{editorPanel}</main>
    </div>
  );

  // ── Mobile Layout ──────────────────────────────────────────────────

  const mobileLayout = (
    <div className="flex flex-col md:hidden" style={{ height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          height: "3.5rem",
          borderBottom: "1px solid var(--color-line)",
          background: "var(--color-panel)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>notes</span>
        {view.kind === "list" && (
          <button
            onClick={createNote}
            style={{
              ...btnBase,
              background: "var(--color-accent)",
              color: "#fff",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            + New
          </button>
        )}
      </header>
      <main style={{ flex: 1, overflow: "auto" }}>
        {view.kind === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {renderNoteList(true)}
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                fontSize: "0.75rem",
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
                Part of FreeAppStore — free forever
              </a>
            </div>
          </div>
        ) : (
          editorPanel
        )}
      </main>
    </div>
  );

  return (
    <>
      {desktopLayout}
      {mobileLayout}
    </>
  );
}

export default App;
