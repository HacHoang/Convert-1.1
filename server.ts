import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createGoogleAuthRouter } from './server/googleAuth.ts';
import { createWebImportRouter } from './server/webImport.ts';

const app = express();
app.disable('x-powered-by');
app.use('/api/web-import', createWebImportRouter());
app.use('/api/auth', createGoogleAuthRouter({ clientId: process.env.GOOGLE_CLIENT_ID, appUrl: process.env.APP_URL, production: process.env.NODE_ENV === 'production' }));
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
