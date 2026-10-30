import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createGoogleAuthRouter } from './server/googleAuth.ts';
import express from 'express';
import { createWebImportRouter } from './server/webImport.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const router = createGoogleAuthRouter({ clientId: env.GOOGLE_CLIENT_ID, appUrl: env.APP_URL && !env.APP_URL.startsWith('MY_') ? env.APP_URL : undefined });
  const authApp = express();
  authApp.disable('x-powered-by');
  authApp.use('/api/web-import', createWebImportRouter());
  authApp.use('/api/auth', router);
  return {
    plugins: [react(), tailwindcss(), {
      name: 'google-auth-api',
      configureServer(server) { server.middlewares.use((req, res, next) => authApp(req as express.Request, res as express.Response, next)); },
      configurePreviewServer(server) { server.middlewares.use((req, res, next) => authApp(req as express.Request, res as express.Response, next)); },
    }],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
