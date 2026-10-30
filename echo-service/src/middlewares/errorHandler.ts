import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || getDefaultErrorCode(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const getDefaultErrorCode = (statusCode: number): string => {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
};

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode;
  let message = err.message || "Internal server error";
  let code = err.code || getDefaultErrorCode(statusCode || 500);

  if (err.name === "ZodError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message =
      err.errors
        ?.map((e: any) => `${e.path.join(".") || "field"}: ${e.message}`)
        .join(", ") || "Validation error";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
  } else if (!statusCode) {
    statusCode = 500;
    code = "INTERNAL_SERVER_ERROR";
  }

  if (process.env.NODE_ENV !== "test" && statusCode === 500) {
    console.error("[Error Handler]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      message,
    },
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};
