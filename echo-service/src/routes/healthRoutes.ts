import { Router, Request, Response } from "express";

export const healthRoutes = Router();

/**
 * GET /api/health
 * Ultra-fast endpoint to verify Express process boot.
 * Intentionally avoids DB access so ping responses return in single-digit milliseconds once awake.
 */
healthRoutes.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
