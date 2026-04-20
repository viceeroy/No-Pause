import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          clerk: ["@clerk/clerk-react"],
          convex: ["convex", "convex/react", "convex/react-clerk"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "../convex"),
      "convex/server": path.resolve(
        __dirname,
        "./node_modules/convex/dist/esm/server/index.js",
      ),
    },
  },
}));
