import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // Use container path for production, local path for testing
  const distPath = process.env.NODE_ENV === 'production' && process.env.PORT === '8080' 
    ? "/app/dist" 
    : path.resolve(process.cwd(), "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    const indexPath = process.env.NODE_ENV === 'production' && process.env.PORT === '8080'
      ? "/app/dist/index.html"
      : path.resolve(process.cwd(), "dist", "index.html");
    res.sendFile(indexPath);
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
