import express from "express";
import cors from "cors";
import { setupRoutes } from "./routes.js";

const app = express();
const PORT = process.env.ATLAS_API_PORT || 4000;

// Enable CORS for Next.js dev server
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Setup routes
setupRoutes(app);

// Handle client disconnect
app.use((_req, res, next) => {
  res.on("close", () => {
    console.log("Client disconnected");
  });
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ATLAS API Server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Stream endpoint: http://localhost:${PORT}/api/atlas/stream`);
  console.log(`   Allowed origin: ${process.env.CORS_ORIGIN || "http://localhost:3000"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
