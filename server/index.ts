import express, { Request, Response, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import fileUpload from 'express-fileupload';
import { resolvers } from './routes.ts';
import { validateEnvironmentVariables } from './utils/util.ts';

try {
  validateEnvironmentVariables();
  console.log('✅ Environment variables validated');
  // unknown better than any 
} catch (error: unknown) {
  const err = error as Error;
  console.error(
    '❌ Environment variable validation failed:',
    err.message
  );
  process.exit(1); // Exit the process if environment variables are missing
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: express.Application = express();
const port: string | number = process.env.PORT || 3000;
const isProd: boolean = process.env.NODE_ENV === 'production';

// Add debug logging middleware for all environments
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

if (isProd) {
  // Production mode - serve the built React app
  const buildPath: string = path.resolve(__dirname, 'app/dist');
  if (existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(buildPath, 'index.html'));
    });
  } else {
    console.log(
      'Production build not found. Run `yarn build` in `src/app` directory.'
    );
  }
} else {
  // Development mode - set up API + proxy to Vite dev server

  // 1. Configure middleware (BEFORE routes)
  app.use(express.json());
  app.use(fileUpload());

  // 2. Set up API routes
  const router = Router();

  console.log('Registering API routes:');
  resolvers.forEach((resolver) => {
    console.log(
      `  ${resolver.method.toUpperCase()} ${resolver.route}`
    );
    router[resolver.method](resolver.route, resolver.handler);
  });

  // 3. Apply API routes
  app.use(router);

  // 4. Set up static file serving
  app.use('/data', express.static(join(__dirname, '../data')));

  // 5. Final catch-all: proxy everything else to Vite dev server
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:5173/',
      changeOrigin: true,
      ws: true,
      
    })
  );
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
  console.log(
    `Environment: ${isProd ? 'production' : 'development'}`
  );
  console.log(`Data directory: ${path.join(__dirname, '../data')}`);
});
