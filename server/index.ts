import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { customErrorHandler, handle404 } from "./middleware/error-handler";
import { BackgroundJobsService } from "./services/background-jobs";
import { WebSocketService } from "./services/websocket-service";
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

      console.log(`${new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })} [express] ${logLine}`);
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

  // Load appropriate modules based on environment
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("../viteDev");
    await setupVite(app, server);
  } else {
    console.log('Loading production static files...');
    const { serveStatic } = await import("../viteProd");
    serveStatic(app);
    console.log('Production static files configured');
  }

  // Add custom error handlers to hide Replit branding AFTER setup
  app.use(customErrorHandler);
  
  // Handle 404s professionally LAST
  app.use('*', handle404);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // For Google Cloud Run, this MUST be 8080. For Replit dev, default to 5000.
  const port = parseInt(process.env.PORT || (process.env.NODE_ENV === 'production' ? '8080' : '5000'), 10);
  // Always bind to 0.0.0.0 for containerized deployments
  const host = "0.0.0.0";
  
  server.listen({
    port,
    host,
    reusePort: process.platform !== 'win32',
  }, async () => {
    const { log } = process.env.NODE_ENV === "development" 
      ? await import("../viteDev")
      : await import("../viteProd");
    
    // Initialize WebSocket service
    WebSocketService.initialize(server);
    
    // Clear startup messages
    console.log('\n' + '='.repeat(50));
    console.log('🚀 IEVOLVE EVENT MANAGEMENT SYSTEM');
    console.log('='.repeat(50));
    console.log(`✅ Database connected`);
    console.log(`✅ Routes registered`); 
    console.log(`✅ WebSocket server enabled on /ws`);
    console.log(`✅ Server listening on ${host}:${port}`);
    console.log(`📱 Admin Panel: http://localhost:${port}/admin`);
    console.log(`👨‍💼 Coach Portal: http://localhost:${port}/coach`);
    console.log(`🏥 Technical Admin: http://localhost:${port}/technical-admin`);
    console.log('='.repeat(50));
    console.log('🎉 APPLICATION READY FOR TRAFFIC');
    console.log('='.repeat(50) + '\n');
    
    // Delay background jobs to ensure server is stable first
    console.log('⏳ Starting background services in 3 seconds...\n');
    setTimeout(() => {
      console.log('🔄 Initializing background services...');
      const backgroundJobs = new BackgroundJobsService();
      backgroundJobs.start();
    }, 3000);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
})();
