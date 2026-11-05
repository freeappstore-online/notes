/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { pwaOptions } from "@freeappstore/sdk/pwa-config";

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions())],
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
