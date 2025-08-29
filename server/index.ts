import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { customErrorHandler, handle404 } from "./middleware/error-handler";
console.log('NODE_ENV:', process.env.NODE_ENV);

const app = express();

// Configure trust proxy for custom domains
app.set('trust proxy', true);

// Add CORS and custom domain support
app.use((req, res, next) => {
  // Allow requests from custom domain
  const allowedOrigins = [
    'https://www.greatorsoftware.com',
    'http://www.greatorsoftware.com',
    'https://greatorsoftware.com',
    'http://greatorsoftware.com'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Serve custom error pages for white-label experience
  app.use('/error-page.html', express.static('error-page.html'));
  app.use('/mobile-iframe.html', express.static('mobile-iframe.html'));
  
  // Serve static error pages that work even when server is down
  app.use('/503.html', express.static('public/503.html'));
  app.use('/404.html', express.static('public/404.html'));
  app.use('/public', express.static('public'));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
     const { setupVite } = await import("./vite"); // dynamic import here
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Add custom error handlers to hide Replit branding AFTER vite setup
  app.use(customErrorHandler);
  
  // Handle 404s professionally LAST
  app.use('*', handle404);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '8080', 10);
  // Windows compatibility: use localhost instead of 0.0.0.0
  const host = process.platform === 'win32' ? 'localhost' : "0.0.0.0";
  
  server.listen({
    port,
    host,
    reusePort: process.platform !== 'win32',
  }, () => {
    log(`serving on port ${port}`);
  });
})();
