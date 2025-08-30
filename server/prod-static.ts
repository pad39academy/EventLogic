import express, { type Express } from "express";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const staticPath = path.resolve(process.cwd(), "dist/public");
  
  // Serve static files from the build output
  app.use(express.static(staticPath));

  // Serve the SPA for all unmatched routes
  app.use("*", (req, res) => {
    const indexPath = path.join(staticPath, "index.html");
    res.sendFile(indexPath);
  });
}