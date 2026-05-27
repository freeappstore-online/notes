export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type View = { kind: "list" } | { kind: "editor"; noteId: string };

export const STORAGE_KEY = "notes_data";

export function migrateNote(n: Record<string, unknown>): Note {
  return {
    id: typeof n.id === "string" ? n.id : crypto.randomUUID(),
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    pinned: typeof n.pinned === "boolean" ? n.pinned : false,
    tags: Array.isArray(n.tags) && n.tags.every((t) => typeof t === "string")
      ? (n.tags as string[])
      : [],
    createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
    updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
  };
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>[]).map(migrateNote) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function filterAndSort(notes: Note[], search: string): Note[] {
  return notes
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
}

export function createNote(): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    pinned: false,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}
