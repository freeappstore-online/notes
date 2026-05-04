import { useState, useEffect, useCallback } from "react";
import { Shell } from "./components/Shell";

interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

const STORAGE_KEY = "notes-app-data";

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Note[];
  } catch {
    // ignore corrupt data
  }
  return [];
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  const filtered = notes
    .filter((n) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const createNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setSearch("");
  }, []);

  const updateNote = useCallback((id: string, text: string) => {
    const lines = text.split("\n");
    const title = lines[0] ?? "";
    const body = lines.slice(1).join("\n");
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, title, body, updatedAt: Date.now() } : n,
      ),
    );
  }, []);

  const deleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  const editorContent = activeNote
    ? activeNote.title + (activeNote.body ? "\n" + activeNote.body : "")
    : "";

  return (
    <Shell>
      <div className="flex h-full" style={{ margin: "-2rem" }}>
        {/* Note list panel */}
        <div
          className="flex flex-col shrink-0 border-r h-full"
          style={{
            width: "18rem",
            borderColor: "var(--line)",
            background: "var(--panel)",
          }}
        >
          {/* Search + New */}
          <div
            className="flex items-center gap-2 p-3 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none px-3 py-1.5"
              style={{
                background: "var(--paper)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: "0.75rem",
              }}
            />
            <button
              onClick={createNote}
              title="New note"
              className="shrink-0 flex items-center justify-center text-white font-bold text-lg leading-none cursor-pointer"
              style={{
                width: "2rem",
                height: "2rem",
                background: "var(--accent)",
                borderRadius: "0.75rem",
                border: "none",
              }}
            >
              +
            </button>
          </div>

          {/* Note list */}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 && (
              <p
                className="text-sm p-4 text-center"
                style={{ color: "var(--muted)" }}
              >
                {search ? "No matching notes" : "No notes yet"}
              </p>
            )}
            {filtered.map((note) => (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className="w-full text-left px-4 py-3 border-b cursor-pointer"
                style={{
                  borderColor: "var(--line)",
                  background:
                    note.id === activeId ? "var(--paper)" : "transparent",
                }}
              >
                <div
                  className="text-sm font-medium truncate"
                  style={{ color: "var(--ink)" }}
                >
                  {note.title || "Untitled"}
                </div>
                <div
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--muted)" }}
                >
                  {formatTime(note.updatedAt)}
                  {note.body && (
                    <span className="ml-2">
                      {note.body.slice(0, 40).replace(/\n/g, " ")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 flex flex-col h-full">
          {activeNote ? (
            <>
              <div
                className="flex items-center justify-between px-6 py-3 border-b shrink-0"
                style={{ borderColor: "var(--line)" }}
              >
                <span
                  className="text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  Last edited {formatTime(activeNote.updatedAt)}
                </span>
                <button
                  onClick={() => deleteNote(activeNote.id)}
                  className="text-xs cursor-pointer px-3 py-1"
                  style={{
                    color: "var(--error)",
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: "0.75rem",
                  }}
                >
                  Delete
                </button>
              </div>
              <textarea
                value={editorContent}
                onChange={(e) => updateNote(activeNote.id, e.target.value)}
                className="flex-1 w-full resize-none outline-none p-6 text-base leading-relaxed"
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "none",
                  fontFamily: "Manrope, system-ui, sans-serif",
                }}
                placeholder="Start writing... (first line is the title)"
                autoFocus
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p
                  className="text-lg mb-2"
                  style={{ color: "var(--muted)" }}
                >
                  Select a note or create a new one
                </p>
                <button
                  onClick={createNote}
                  className="text-sm cursor-pointer px-4 py-2 text-white"
                  style={{
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: "0.75rem",
                  }}
                >
                  New Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
