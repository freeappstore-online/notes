import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

type View = { kind: "list" } | { kind: "editor"; noteId: string };

// ── Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = "notes_data";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
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

// ── App ────────────────────────────────────────────────────────────────

export function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [view, setView] = useState<View>({ kind: "list" });
  const [search, setSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const activeNote =
    view.kind === "editor"
      ? (notes.find((n) => n.id === view.noteId) ?? null)
      : null;

  const filtered = notes
    .filter((n) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const createNote = useCallback(() => {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setView({ kind: "editor", noteId: note.id });
    setSearch("");
  }, []);

  const updateNote = useCallback((id: string, text: string) => {
    const lines = text.split("\n");
    const title = lines[0] ?? "";
    const body = lines.slice(1).join("\n");
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title, body, updatedAt: Date.now() } : n)),
    );
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setView({ kind: "list" });
  }, []);

  const openNote = useCallback((id: string) => {
    setView({ kind: "editor", noteId: id });
  }, []);

  const goBack = useCallback(() => {
    setView({ kind: "list" });
  }, []);

  // Focus textarea when opening editor
  useEffect(() => {
    if (view.kind === "editor" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [view]);

  const editorContent = activeNote
    ? activeNote.title + (activeNote.body ? "\n" + activeNote.body : "")
    : "";

  // ── Note list (shared between sidebar + mobile) ────────────────────

  const noteList = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Search + New button */}
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
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "var(--color-paper)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-btn)",
            padding: "0.375rem 0.75rem",
            fontSize: "0.875rem",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
        />
        <button onClick={createNote} title="New note" style={{
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
        }}>
          +
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <p style={{ color: "var(--color-muted)", fontSize: "0.875rem", textAlign: "center", padding: "2rem 1rem" }}>
            {search ? "No matching notes" : "No notes yet"}
          </p>
        )}
        {filtered.map((note) => (
          <button
            key={note.id}
            onClick={() => openNote(note.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--color-line)",
              background: view.kind === "editor" && view.noteId === note.id
                ? "var(--color-paper)"
                : "transparent",
              border: "none",
              borderBlockEnd: "1px solid var(--color-line)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            <div style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {note.title || "Untitled"}
            </div>
            <div style={{
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              marginTop: "0.125rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {formatTime(note.updatedAt)}
              {note.body && (
                <span style={{ marginLeft: "0.5rem" }}>
                  {note.body.slice(0, 40).replace(/\n/g, " ")}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Editor panel ───────────────────────────────────────────────────

  const editorPanel = activeNote ? (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--color-line)",
          flexShrink: 0,
        }}
      >
        {/* Back button (mobile only) */}
        <button
          onClick={goBack}
          className="md:hidden"
          style={{
            ...btnGhost,
            marginRight: "0.75rem",
          }}
        >
          Back
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", flex: 1 }}>
          {formatTime(activeNote.updatedAt)}
        </span>
        <button onClick={() => deleteNote(activeNote.id)} style={btnGhost}>
          Delete
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={editorContent}
        onChange={(e) => updateNote(activeNote.id, e.target.value)}
        placeholder="Start writing... (first line becomes the title)"
        style={{
          flex: 1,
          width: "100%",
          resize: "none",
          outline: "none",
          padding: "1.5rem",
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
    </div>
  ) : (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--color-muted)", fontSize: "1rem", marginBottom: "0.75rem" }}>
          Select a note or create a new one
        </p>
        <button onClick={createNote} style={btnPrimary}>
          New Note
        </button>
      </div>
    </div>
  );

  // ── Desktop Layout ─────────────────────────────────────────────────

  const desktopLayout = (
    <div className="hidden md:flex" style={{ height: "100vh" }}>
      {/* App sidebar with branding */}
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
        <div style={{
          padding: "1.5rem",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "1.125rem",
        }}>
          notes
        </div>

        {/* Note list fills the sidebar */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {noteList}
        </div>

        <div style={{
          padding: "1rem",
          fontSize: "0.75rem",
          color: "var(--color-muted)",
        }}>
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

      {/* Main editor area */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {editorPanel}
      </main>
    </div>
  );

  // ── Mobile Layout ──────────────────────────────────────────────────

  const mobileLayout = (
    <div className="flex flex-col md:hidden" style={{ height: "100vh" }}>
      {/* Header */}
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
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
          notes
        </span>
        {view.kind === "list" && (
          <button onClick={createNote} style={{
            ...btnBase,
            background: "var(--color-accent)",
            color: "#fff",
            padding: "0.375rem 0.75rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
          }}>
            + New
          </button>
        )}
      </header>

      {/* Content: either list or editor */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {view.kind === "list" ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Mobile search */}
            <div style={{
              padding: "0.75rem",
              borderBottom: "1px solid var(--color-line)",
            }}>
              <input
                type="text"
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--color-panel)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-btn)",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.875rem",
                  outline: "none",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>

            {/* Mobile note list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <p style={{
                  color: "var(--color-muted)",
                  fontSize: "0.875rem",
                  textAlign: "center",
                  padding: "3rem 1rem",
                }}>
                  {search ? "No matching notes" : "No notes yet — tap + New to start"}
                </p>
              )}
              {filtered.map((note) => (
                <button
                  key={note.id}
                  onClick={() => openNote(note.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.875rem 1rem",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--color-line)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <div style={{
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--color-ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {note.title || "Untitled"}
                  </div>
                  <div style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-muted)",
                    marginTop: "0.25rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {formatTime(note.updatedAt)}
                    {note.body && (
                      <span style={{ marginLeft: "0.5rem" }}>
                        {note.body.slice(0, 50).replace(/\n/g, " ")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* FreeAppStore link */}
            <div style={{
              padding: "1rem",
              textAlign: "center",
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              flexShrink: 0,
            }}>
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
