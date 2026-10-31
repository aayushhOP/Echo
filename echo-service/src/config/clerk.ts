import { createClerkClient } from "@clerk/backend";
import { ENV } from "./env";

export const clerkClient = createClerkClient({
  secretKey: ENV.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY,
  publishableKey: ENV.CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY,
});
