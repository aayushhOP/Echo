import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode;
  let message = err.message || "Internal server error";

  if (err.name === "ZodError") {
    statusCode = 400;
    message = err.errors?.map((e: any) => `${e.path.join(".") || "field"}: ${e.message}`).join(", ") || "Validation error";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
  } else if (!statusCode) {
    statusCode = 500;
  }

  if (process.env.NODE_ENV !== "test" && statusCode === 500) {
    console.error("[Error Handler]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};
