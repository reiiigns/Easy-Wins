import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import analyzeRouter from "./routes/analyze.js";
import { getAnalyzerRuntimeLabel, shutdownAnalyzer } from "./services/analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const allowedOrigins = new Set(["http://localhost:5173", "http://localhost:3000"]);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || origin === "null" || origin === "file://" || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

function resolveDistPath(): string {
  const candidates = [
    path.resolve(__dirname, ".."),
    path.resolve(__dirname, "../dist"),
  ];

  return candidates.find(candidate => fs.existsSync(path.join(candidate, "index.html"))) || candidates[1];
}

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// API routes
app.use("/api", analyzeRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve static files from dist/ in production
const distPath = resolveDistPath();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(distPath));

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

let server: ReturnType<typeof app.listen>;

function shutdown(): void {
  shutdownAnalyzer();
  server?.close(() => process.exit(0));
}

export async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[Server] Easy Wins API running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`[Server] Analyzer: ${getAnalyzerRuntimeLabel()}`);
      resolve();
    });
  });
}

export { shutdown };

// Self-start when run directly (not imported by Electron)
const isMain = process.argv[1] && fileURLToPath(import.meta.url).replace(/\\/g, "/") === process.argv[1].replace(/\\/g, "/");
if (isMain) {
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  startServer();
}
