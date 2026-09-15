import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// LINT.IfChange(aistudio_media_plugin)
function aistudioMediaPlugin(): Plugin {
  return {
    name: 'vite-plugin-aistudio-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/assets/aistudio/')) {
          const rawPath = req.url.split('?')[0].split('#')[0];
          try {
            const decodedPath = decodeURIComponent(rawPath);
            const relativePath = decodedPath.replace(/^\//, '');
            const aistudioDir = path.resolve(
              __dirname,
              'public',
              'assets',
              'aistudio',
            );
            const filePath = path.resolve(__dirname, 'public', relativePath);
            if (
              filePath.startsWith(aistudioDir + path.sep) &&
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isFile()
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeMap: Record<string, string> = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.svg': 'image/svg+xml',
                '.bmp': 'image/bmp',
                '.ico': 'image/x-icon',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.pdf': 'application/pdf',
              };
              res.setHeader(
                'Content-Type',
                mimeMap[ext] || 'application/octet-stream',
              );
              res.setHeader('Cache-Control', 'no-cache');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // Fall through if URI decoding or file access fails
          }
        }
        next();
      });
    },
  };
}
// LINT.ThenChange(//depot/google3/java/com/google/alkali/boq/makersuite/applet_dev_service/templates/initializers/react_theme/vite.config.ts:aistudio_media_plugin)

function frontendDashboardPlugin(): Plugin {
  return {
    name: 'vite-plugin-frontend-dashboard',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const urlPath = req.url.split('?')[0];
        if (urlPath === '/dashboard.html' || urlPath === '/dashboard') {
          const dashboardPath = path.resolve(__dirname, '..', 'dashboard.html');
          const fallbackPath = path.resolve(__dirname, '..', 'index.html');
          const targetPath = fs.existsSync(dashboardPath) ? dashboardPath : fallbackPath;
          if (fs.existsSync(targetPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return fs.createReadStream(targetPath).pipe(res);
          }
        }
        if (
          urlPath.startsWith('/css/') ||
          urlPath.startsWith('/js/') ||
          urlPath.startsWith('/assets/') ||
          urlPath.startsWith('/images/')
        ) {
          const staticPath = path.resolve(__dirname, '..', urlPath.replace(/^\//, ''));
          if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
            const ext = path.extname(staticPath).toLowerCase();
            const mimeMap: Record<string, string> = {
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
            };
            res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
            return fs.createReadStream(staticPath).pipe(res);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aistudioMediaPlugin(), frontendDashboardPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:5050',
          changeOrigin: true,
        },
      },
    },
  };
});
