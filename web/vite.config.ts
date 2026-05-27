/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          tiptap: [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-placeholder",
            "@tiptap/extension-task-list",
            "@tiptap/extension-task-item",
            "@tiptap/extension-highlight",
            "@tiptap/extension-link",
            "@tiptap/extension-typography",
            "@tiptap/suggestion",
          ],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    pool: "forks",
    setupFiles: ["./src/test-setup.ts"],
  },
});
