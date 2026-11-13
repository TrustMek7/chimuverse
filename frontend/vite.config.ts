import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          )
            return "react";
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
