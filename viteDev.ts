import express, { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { type Server } from "http";
// import viteConfig from "./vite.config"; // Removed due to __dirname ES module issue

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    root: 'client',
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './client/src'),
        '@shared': path.resolve(process.cwd(), './shared'),
        '@assets': path.resolve(process.cwd(), './attached_assets'),
      },
    },
    server: {
      middlewareMode: true,
      hmr: { 
        server,
        overlay: false, // Disable error overlay that can cause issues
        clientPort: 5000 // Use same port as main server
      },
      allowedHosts: true,
      watch: {
        usePolling: true, // Better compatibility in cloud environments
        interval: 2000,   // Reduce polling frequency to prevent connection spam
      }
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      // Don't exit on errors, just log them
      error: (msg, options) => {
        if (!msg.includes('WebSocket server error') && !msg.includes('server connection')) {
          viteLogger.error(msg, options);
        }
      },
      warn: (msg, options) => {
        // Suppress WebSocket connection warnings that spam the console
        if (!msg.includes('WebSocket server error') && !msg.includes('server connection')) {
          viteLogger.warn(msg, options);
        }
      },
    },
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`[${formattedTime}] [${source}] ${message}`);
}
