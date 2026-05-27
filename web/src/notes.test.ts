import { describe, it, expect, beforeEach } from "vitest";
import {
  migrateNote,
  loadNotes,
  saveNotes,
  formatTime,
  filterAndSort,
  createNote,
  STORAGE_KEY,
  type Note,
} from "./notes";

// ── migrateNote ───────────────────────────────────────────────────────

describe("migrateNote", () => {
  it("passes through a complete note unchanged", () => {
    const input = {
      id: "abc",
      title: "Hello",
      body: "World",
      pinned: true,
      tags: ["work"],
      createdAt: 1000,
      updatedAt: 2000,
    };
    expect(migrateNote(input)).toEqual(input);
  });

  it("fills in defaults for old-format notes without pinned/tags", () => {
    const old = { id: "x", title: "Old", body: "Note", createdAt: 100, updatedAt: 200 };
    const result = migrateNote(old);
    expect(result.pinned).toBe(false);
    expect(result.tags).toEqual([]);
    expect(result.title).toBe("Old");
  });

  it("generates an id when missing", () => {
    const result = migrateNote({ title: "No ID" });
    expect(result.id).toBeTruthy();
    expect(typeof result.id).toBe("string");
  });

  it("handles completely empty object", () => {
    const result = migrateNote({});
    expect(result.title).toBe("");
    expect(result.body).toBe("");
    expect(result.pinned).toBe(false);
    expect(result.tags).toEqual([]);
    expect(typeof result.id).toBe("string");
  });

  it("rejects non-string tags array", () => {
    const result = migrateNote({ tags: [1, 2, 3] });
    expect(result.tags).toEqual([]);
  });

  it("rejects non-boolean pinned values", () => {
    const result = migrateNote({ pinned: "yes" });
    expect(result.pinned).toBe(false);
  });

  it("preserves pinned: false (not overwritten by default)", () => {
    const result = migrateNote({ pinned: false });
    expect(result.pinned).toBe(false);
  });
});

// ── loadNotes / saveNotes ─────────────────────────────────────────────

describe("loadNotes / saveNotes", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when nothing stored", () => {
    expect(loadNotes()).toEqual([]);
  });

  it("roundtrips notes through localStorage", () => {
    const notes: Note[] = [
      {
        id: "1",
        title: "Test",
        body: "Body",
        pinned: false,
        tags: ["a"],
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    saveNotes(notes);
    const loaded = loadNotes();
    expect(loaded).toEqual(notes);
  });

  it("returns empty array on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not json!!!");
    expect(loadNotes()).toEqual([]);
  });

  it("migrates old notes on load", () => {
    const old = [{ id: "old", title: "Legacy", body: "Note", createdAt: 1, updatedAt: 2 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    const loaded = loadNotes();
    expect(loaded[0]!.pinned).toBe(false);
    expect(loaded[0]!.tags).toEqual([]);
  });
});

// ── formatTime ────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("shows time for same-day timestamps", () => {
    const now = new Date();
    now.setHours(14, 30, 0, 0);
    const result = formatTime(now.getTime());
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("shows date for different-day timestamps", () => {
    const old = new Date(2024, 0, 15).getTime();
    const result = formatTime(old);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });
});

// ── filterAndSort ─────────────────────────────────────────────────────

describe("filterAndSort", () => {
  const base: Note = {
    id: "1",
    title: "",
    body: "",
    pinned: false,
    tags: [],
    createdAt: 100,
    updatedAt: 100,
  };

  it("returns all notes when search is empty", () => {
    const notes = [
      { ...base, id: "a", title: "Alpha" },
      { ...base, id: "b", title: "Beta" },
    ];
    expect(filterAndSort(notes, "")).toHaveLength(2);
  });

  it("filters by title", () => {
    const notes = [
      { ...base, id: "a", title: "Shopping list" },
      { ...base, id: "b", title: "Meeting notes" },
    ];
    const result = filterAndSort(notes, "shop");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a");
  });

  it("filters by body", () => {
    const notes = [
      { ...base, id: "a", title: "Note", body: "buy milk and eggs" },
      { ...base, id: "b", title: "Note", body: "nothing here" },
    ];
    const result = filterAndSort(notes, "milk");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a");
  });

  it("filters by tags", () => {
    const notes = [
      { ...base, id: "a", title: "Note", tags: ["groceries"] },
      { ...base, id: "b", title: "Note", tags: ["work"] },
    ];
    const result = filterAndSort(notes, "grocer");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a");
  });

  it("search is case-insensitive", () => {
    const notes = [{ ...base, id: "a", title: "IMPORTANT" }];
    expect(filterAndSort(notes, "important")).toHaveLength(1);
  });

  it("sorts pinned notes first", () => {
    const notes = [
      { ...base, id: "unpinned", updatedAt: 300 },
      { ...base, id: "pinned", pinned: true, updatedAt: 100 },
    ];
    const result = filterAndSort(notes, "");
    expect(result[0]!.id).toBe("pinned");
  });

  it("sorts by updatedAt within same pin status", () => {
    const notes = [
      { ...base, id: "old", updatedAt: 100 },
      { ...base, id: "new", updatedAt: 300 },
      { ...base, id: "mid", updatedAt: 200 },
    ];
    const result = filterAndSort(notes, "");
    expect(result.map((n) => n.id)).toEqual(["new", "mid", "old"]);
  });

  it("does not mutate the input array", () => {
    const notes = [
      { ...base, id: "b", updatedAt: 100 },
      { ...base, id: "a", updatedAt: 200 },
    ];
    const copy = [...notes];
    filterAndSort(notes, "");
    expect(notes.map((n) => n.id)).toEqual(copy.map((n) => n.id));
  });
});

// ── createNote ────────────────────────────────────────────────────────

describe("createNote", () => {
  it("creates a note with unique id", () => {
    const a = createNote();
    const b = createNote();
    expect(a.id).not.toBe(b.id);
  });

  it("creates a note with empty content", () => {
    const note = createNote();
    expect(note.title).toBe("");
    expect(note.body).toBe("");
    expect(note.pinned).toBe(false);
    expect(note.tags).toEqual([]);
  });

  it("sets createdAt and updatedAt to the same value", () => {
    const note = createNote();
    expect(note.createdAt).toBe(note.updatedAt);
    expect(note.createdAt).toBeGreaterThan(0);
  });
});
