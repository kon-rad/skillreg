import { defineConfig } from "vite"
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  // Local testing: /rpc proxies to the Arkiv dev node, so the page can use ?chain=local&rpc=/rpc
  server: { proxy: { "/rpc": { target: "http://127.0.0.1:18545", changeOrigin: true, rewrite: () => "/" } } },
})
