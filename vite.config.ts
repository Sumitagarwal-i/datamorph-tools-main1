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
          // Split large dependencies for better caching + parallel loading.
          // Avoid forcing all app components into one mega-chunk.
          if (id.includes('node_modules')) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react';
            }
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) return 'monaco';
            if (id.includes('@tiptap')) return 'tiptap';
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('react-router')) return 'router';
            return 'vendor';
          }
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
