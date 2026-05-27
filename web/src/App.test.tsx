import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { STORAGE_KEY } from "./notes";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

function flushDebounce() {
  act(() => {
    vi.advanceTimersByTime(350);
  });
}

describe("App", () => {
  it("renders empty state", () => {
    render(<App />);
    expect(screen.getAllByText(/Welcome to Notes/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Create your first page/).length).toBeGreaterThanOrEqual(1);
  });

  it("creates a note via quick note (Cmd+N) and opens editor", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    expect(screen.getAllByPlaceholderText("Untitled").length).toBeGreaterThanOrEqual(1);
  });

  it("persists note title to localStorage after debounce", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const titleInputs = screen.getAllByPlaceholderText("Untitled");
    await user.type(titleInputs[0]!, "My First Note");
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].title).toBe("My First Note");
  });

  it("soft-deletes a note (moves to trash)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const titleInputs = screen.getAllByPlaceholderText("Untitled");
    await user.type(titleInputs[0]!, "To Delete");
    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]!);
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].deletedAt).toEqual(expect.any(Number));
  });

  it("searches notes by title", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", parentId: null, title: "Groceries", body: "", pinned: false, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 2 },
        { id: "2", parentId: null, title: "Meeting", body: "", pinned: false, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 1 },
      ]),
    );
    render(<App />);
    const searchInputs = screen.getAllByPlaceholderText("Search...");
    await user.type(searchInputs[0]!, "grocer");
    expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Meeting")).not.toBeInTheDocument();
  });

  it("toggles pin on a note without changing updatedAt", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", parentId: null, title: "Test", body: "x", pinned: false, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 42 },
      ]),
    );
    render(<App />);
    const noteItems = screen.getAllByText("Test");
    await user.click(noteItems[0]!);
    const pinButtons = screen.getAllByText("Pin");
    await user.click(pinButtons[0]!);
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].pinned).toBe(true);
    expect(stored[0].updatedAt).toBe(42);
  });

  it("adds a tag to a note", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const tagInputs = screen.getAllByPlaceholderText("Add tags...");
    await user.type(tagInputs[0]!, "work{Enter}");
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].tags).toContain("work");
  });

  it("splits comma-separated tags", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const tagInputs = screen.getAllByPlaceholderText("Add tags...");
    await user.type(tagInputs[0]!, "work,life,fun{Enter}");
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored[0].tags).toEqual(["work", "life", "fun"]);
  });

  it("navigates back to list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    expect(screen.getAllByPlaceholderText("Untitled").length).toBeGreaterThanOrEqual(1);
    const backButtons = screen.getAllByText("Back");
    await user.click(backButtons[0]!);
    expect(screen.queryAllByPlaceholderText("Untitled")).toHaveLength(0);
  });

  it("cleans up empty notes on navigate back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const backButtons = screen.getAllByText("Back");
    await user.click(backButtons[0]!);
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(0);
  });

  it("keeps non-empty notes on navigate back", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await user.keyboard("{Meta>}n{/Meta}");
    const titleInputs = screen.getAllByPlaceholderText("Untitled");
    await user.type(titleInputs[0]!, "Keep me");
    const backButtons = screen.getAllByText("Back");
    await user.click(backButtons[0]!);
    flushDebounce();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Keep me");
  });

  it("loads existing notes from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", parentId: null, title: "Saved Note", body: "content", pinned: false, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 1 },
      ]),
    );
    render(<App />);
    expect(screen.getAllByText("Saved Note").length).toBeGreaterThanOrEqual(1);
  });

  it("searches by tag", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", parentId: null, title: "A", body: "", pinned: false, tags: ["urgent"], icon: "", template: null, createdAt: 1, updatedAt: 2 },
        { id: "2", parentId: null, title: "B", body: "", pinned: false, tags: ["low"], icon: "", template: null, createdAt: 1, updatedAt: 1 },
      ]),
    );
    render(<App />);
    const searchInputs = screen.getAllByPlaceholderText("Search...");
    await user.type(searchInputs[0]!, "urgent");
    expect(screen.getAllByText("A").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("B")).not.toBeInTheDocument();
  });

  it("shows pinned notes first in the list", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1", parentId: null, title: "Unpinned", body: "", pinned: false, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 300 },
        { id: "2", parentId: null, title: "Pinned", body: "", pinned: true, tags: [], icon: "", template: null, createdAt: 1, updatedAt: 100 },
      ]),
    );
    render(<App />);
    const titles = screen.getAllByText(/^(Pinned|Unpinned)$/);
    expect(titles[0]!.textContent).toBe("Pinned");
  });
});
