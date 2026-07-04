// vite.config.ts
import { defineConfig } from "file:///app/No-Pause/node_modules/.pnpm/vite@5.4.21_@types+node@22.20.0/node_modules/vite/dist/node/index.js";
import react from "file:///app/No-Pause/node_modules/.pnpm/@vitejs+plugin-react-swc@3.11.0_vite@5.4.21_@types+node@22.20.0_/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "/app/No-Pause";
var vite_config_default = defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__vite_injected_original_dirname, "index.html")
      },
      output: {
        manualChunks(id) {
          if (id.includes("/src/features/practice/")) {
            return "practice";
          }
          if (id.includes("node_modules")) {
            if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/") || id.includes("/node_modules/scheduler/")) {
              return "react";
            }
            if (id.includes("/node_modules/@supabase/")) {
              return "supabase";
            }
            return "vendor";
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL05vLVBhdXNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL05vLVBhdXNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvTm8tUGF1c2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKCkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJpbmRleC5odG1sXCIpLFxuICAgICAgfSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCIvc3JjL2ZlYXR1cmVzL3ByYWN0aWNlL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwicHJhY3RpY2VcIjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCIvbm9kZV9tb2R1bGVzL3JlYWN0L1wiKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcyhcIi9ub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSB8fFxuICAgICAgICAgICAgICBpZC5pbmNsdWRlcyhcIi9ub2RlX21vZHVsZXMvc2NoZWR1bGVyL1wiKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHJldHVybiBcInJlYWN0XCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIi9ub2RlX21vZHVsZXMvQHN1cGFiYXNlL1wiKSkge1xuICAgICAgICAgICAgICByZXR1cm4gXCJzdXBhYmFzZVwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3JcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWEsT0FBTztBQUFBLEVBQ2pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE9BQU87QUFBQSxJQUNMLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE1BQU0sS0FBSyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxNQUM1QztBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGdCQUNFLEdBQUcsU0FBUyxzQkFBc0IsS0FDbEMsR0FBRyxTQUFTLDBCQUEwQixLQUN0QyxHQUFHLFNBQVMsMEJBQTBCLEdBQ3RDO0FBQ0EscUJBQU87QUFBQSxZQUNUO0FBRUEsZ0JBQUksR0FBRyxTQUFTLDBCQUEwQixHQUFHO0FBQzNDLHFCQUFPO0FBQUEsWUFDVDtBQUVBLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
