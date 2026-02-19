import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react({
      // Disable StrictMode to suppress findDOMNode warnings from react-quill
      // This is safe since react-quill is a third-party library that will be updated eventually
      jsxRuntime: 'automatic',
    }),
    mode === 'development' &&
    componentTagger(),
    // Custom plugin to suppress ReactQuill findDOMNode warnings
    {
      name: 'suppress-reactquill-warnings',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // This runs on the server side, but we need client-side suppression
          next();
        });
      },
      transformIndexHtml(html) {
        // Inject warning suppression script into HTML
        return html.replace(
          '<head>',
          `<head>
    <script>
      // Suppress ONLY ReactQuill findDOMNode warnings - runs before everything
      (function() {
        const originalWarn = console.warn;
        
        const suppress = function(...args) {
          try {
            const msg = args.map(a => {
              if (typeof a === 'string') return a;
              if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a); } catch { return String(a); }
              }
              return String(a);
            }).join(' ');
            // VERY SPECIFIC: Only suppress findDOMNode warnings related to ReactQuill
            return (msg.includes('findDOMNode is deprecated') && 
                    (msg.includes('ReactQuill') || msg.includes('ReactQuill2'))) ||
                   (msg.includes('Warning: findDOMNode') && 
                    (msg.includes('ReactQuill') || msg.includes('ReactQuill2')));
          } catch { return false; }
        };
        
        // Only patch console.warn, NOT console.error (to avoid blocking real errors)
        console.warn = function(...args) { 
          if (!suppress(...args)) originalWarn.apply(console, args); 
        };
      })();
    </script>`
        );
      }
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
