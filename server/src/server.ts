import http from "http";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { ENV } from "./config/env";

const startServer = async () => {
  // Connect Databases
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(ENV.PORT, () => {
    console.log(`[Server] Running on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
  });

  const handleShutdown = async () => {
    console.log("[Server] Gracefully shutting down...");
    server.close(() => {
      console.log("[Server] HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
};

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
