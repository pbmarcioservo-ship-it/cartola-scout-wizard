// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/MARCIO/projetostatusfcgit/cartola-scout-wizard/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/MARCIO/projetostatusfcgit/cartola-scout-wizard/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/MARCIO/projetostatusfcgit/cartola-scout-wizard/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\MARCIO\\projetostatusfcgit\\cartola-scout-wizard";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false
      }
    },
    base: "/",
    build: {
      outDir: "dist",
      assetsDir: "assets"
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey)
    },
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNQVJDSU9cXFxccHJvamV0b3N0YXR1c2ZjZ2l0XFxcXGNhcnRvbGEtc2NvdXQtd2l6YXJkXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNQVJDSU9cXFxccHJvamV0b3N0YXR1c2ZjZ2l0XFxcXGNhcnRvbGEtc2NvdXQtd2l6YXJkXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9NQVJDSU8vcHJvamV0b3N0YXR1c2ZjZ2l0L2NhcnRvbGEtc2NvdXQtd2l6YXJkL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCBcIlwiKTtcclxuXHJcbiAgY29uc3Qgc3VwYWJhc2VVcmwgPSBlbnYuVklURV9TVVBBQkFTRV9VUkwgfHwgZW52LlNVUEFCQVNFX1VSTCB8fCBcIlwiO1xyXG4gIGNvbnN0IHN1cGFiYXNlUHVibGlzaGFibGVLZXkgPVxyXG4gICAgZW52LlZJVEVfU1VQQUJBU0VfUFVCTElTSEFCTEVfS0VZIHx8XHJcbiAgICBlbnYuVklURV9TVVBBQkFTRV9BTk9OX0tFWSB8fFxyXG4gICAgZW52LlNVUEFCQVNFX1BVQkxJU0hBQkxFX0tFWSB8fFxyXG4gICAgZW52LlNVUEFCQVNFX0FOT05fS0VZIHx8XHJcbiAgICBcIlwiO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6IFwiOjpcIixcclxuICAgICAgcG9ydDogODA4MCxcclxuICAgICAgaG1yOiB7XHJcbiAgICAgICAgb3ZlcmxheTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYmFzZTogXCIvXCIsXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6IFwiZGlzdFwiLFxyXG4gICAgICBhc3NldHNEaXI6IFwiYXNzZXRzXCIsXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgIFwiaW1wb3J0Lm1ldGEuZW52LlZJVEVfU1VQQUJBU0VfVVJMXCI6IEpTT04uc3RyaW5naWZ5KHN1cGFiYXNlVXJsKSxcclxuICAgICAgXCJpbXBvcnQubWV0YS5lbnYuVklURV9TVVBBQkFTRV9QVUJMSVNIQUJMRV9LRVlcIjogSlNPTi5zdHJpbmdpZnkoc3VwYWJhc2VQdWJsaXNoYWJsZUtleSksXHJcbiAgICB9LFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3QvanN4LXJ1bnRpbWVcIl0sXHJcbiAgICB9LFxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlXLFNBQVMsY0FBYyxlQUFlO0FBQ3ZZLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBRTNDLFFBQU0sY0FBYyxJQUFJLHFCQUFxQixJQUFJLGdCQUFnQjtBQUNqRSxRQUFNLHlCQUNKLElBQUksaUNBQ0osSUFBSSwwQkFDSixJQUFJLDRCQUNKLElBQUkscUJBQ0o7QUFFRixTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixLQUFLO0FBQUEsUUFDSCxTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxJQUNiO0FBQUEsSUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLFNBQVMsaUJBQWlCLGdCQUFnQixDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQUEsSUFDOUUsUUFBUTtBQUFBLE1BQ04scUNBQXFDLEtBQUssVUFBVSxXQUFXO0FBQUEsTUFDL0QsaURBQWlELEtBQUssVUFBVSxzQkFBc0I7QUFBQSxJQUN4RjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3RDO0FBQUEsTUFDQSxRQUFRLENBQUMsU0FBUyxhQUFhLG1CQUFtQjtBQUFBLElBQ3BEO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
