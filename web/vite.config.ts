import { defineConfig } from "vite"
const dir = import.meta.dirname
export default defineConfig({
  root: dir,
  base: "./",
  build: {
    outDir: "dist", emptyOutDir: true, target: "es2022",
    rollupOptions: { input: { main: `${dir}/index.html`, registry: `${dir}/registry.html`, blog: `${dir}/blog.html`, about: `${dir}/about.html` } },
  },
  server: {
    // web/ has its own package.json; let the dev server read ../src and ../docs too.
    fs: { allow: [`${dir}/..`] },
    // Local testing: /rpc proxies to the Arkiv dev node, so the page can use ?chain=local&rpc=/rpc
    proxy: { "/rpc": { target: "http://127.0.0.1:18545", changeOrigin: true, rewrite: () => "/" } },
  },
})
