import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend never talks to the Anthropic API directly - it calls our
// tiny Express server at /api/*, which holds the real API key. Vite just
// proxies those requests through to that server during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
