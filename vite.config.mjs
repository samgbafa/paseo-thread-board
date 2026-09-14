import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromRoot("./preview"),
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      {
        find: /^@getpaseo\/plugin\/client\/react-native$/,
        replacement: fromRoot("./preview/icon.jsx"),
      },
      {
        find: /^@getpaseo\/plugin\/client$/,
        replacement: fromRoot("./preview/plugin-client.js"),
      },
      { find: "react-native", replacement: "react-native-web" },
    ],
  },
  build: {
    outDir: fromRoot("./dist-preview"),
    emptyOutDir: true,
  },
});
