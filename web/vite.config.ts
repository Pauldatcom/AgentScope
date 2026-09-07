import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // Front calls /api/dashboard; FastAPI serves /dashboard.
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
