export interface Note {
  id: string;
  parentId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  tags: string[];
  icon: string;
  template: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type View =
  | { kind: "list" }
  | { kind: "editor"; noteId: string }
  | { kind: "trash" };

export const STORAGE_KEY = "notes_data";

export function migrateNote(n: Record<string, unknown>): Note {
  return {
    id: typeof n.id === "string" ? n.id : crypto.randomUUID(),
    parentId: typeof n.parentId === "string" ? n.parentId : null,
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    pinned: typeof n.pinned === "boolean" ? n.pinned : false,
    tags: Array.isArray(n.tags) && n.tags.every((t) => typeof t === "string")
      ? (n.tags as string[])
      : [],
    icon: typeof n.icon === "string" ? n.icon : "",
    template: typeof n.template === "string" ? n.template : null,
    createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
    updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
    deletedAt: typeof n.deletedAt === "number" ? n.deletedAt : null,
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
    .filter((n) => n.deletedAt === null)
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

export function getRootNotes(notes: Note[]): Note[] {
  const activeById = new Map(
    notes.filter((n) => n.deletedAt === null).map((n) => [n.id, n] as const),
  );
  return notes.filter(
    (n) =>
      n.deletedAt === null &&
      (n.parentId === null || !activeById.has(n.parentId)),
  );
}

export function getChildren(notes: Note[], parentId: string): Note[] {
  return notes.filter((n) => n.parentId === parentId && n.deletedAt === null);
}

export function getTrash(notes: Note[]): Note[] {
  const deletedById = new Map(
    notes.filter((n) => n.deletedAt !== null).map((n) => [n.id, n] as const),
  );
  return notes
    .filter(
      (n) =>
        n.deletedAt !== null &&
        (n.parentId === null || !deletedById.has(n.parentId)),
    )
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export function createNote(parentId: string | null = null, template: string | null = null): Note {
  const now = Date.now();
  const body = template ? getTemplateBody(template) : "";
  return {
    id: crypto.randomUUID(),
    parentId,
    title: "",
    body,
    pinned: false,
    tags: [],
    icon: "",
    template,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export const TEMPLATES: Record<string, { name: string; icon: string; body: string }> = {
  blank: { name: "Blank", icon: "", body: "" },
  meeting: {
    name: "Meeting Notes",
    icon: "",
    body: `<h2>Attendees</h2><p></p><h2>Agenda</h2><task-list><task-item>Item 1</task-item></task-list><h2>Notes</h2><p></p><h2>Action Items</h2><task-list><task-item>Action 1</task-item></task-list>`,
  },
  journal: {
    name: "Daily Journal",
    icon: "",
    body: `<h2>Today I'm grateful for</h2><p></p><h2>What happened today</h2><p></p><h2>Tomorrow I will</h2><p></p>`,
  },
  project: {
    name: "Project Brief",
    icon: "",
    body: `<h2>Goal</h2><p></p><h2>Background</h2><p></p><h2>Requirements</h2><task-list><task-item>Requirement 1</task-item></task-list><h2>Timeline</h2><p></p><h2>Open Questions</h2><p></p>`,
  },
};

function getTemplateBody(template: string): string {
  return TEMPLATES[template]?.body ?? "";
}
