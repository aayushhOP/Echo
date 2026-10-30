import dns from "dns";
import mongoose from "mongoose";
import { ENV } from "./env";

// Ensure Atlas SRV resolution works across diverse local router/DNS configurations
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Fall back to default system DNS if custom servers cannot be set
}

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("[Database] MongoDB connection failed:", error);
    process.exit(1);
  }
};

