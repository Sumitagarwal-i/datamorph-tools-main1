import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" && visualizer({ open: false, gzipSize: true, brotliSize: true })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2015",
    minify: "terser",
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Only chunk your own code, not libraries!
          if (id.includes('src/pages')) return 'pages';
          if (id.includes('src/components') && !id.includes('ui/')) return 'components';
          if (id.includes('src/lib')) return 'lib';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        inlineDynamicImports: false,
      },
    },
    chunkSizeWarningLimit: 750,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "papaparse",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-dropdown-menu",
      "sonner",
      "next-themes"
    ],
    exclude: ["@monaco-editor/react"],
  },
}));
