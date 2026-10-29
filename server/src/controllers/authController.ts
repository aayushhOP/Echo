import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/authService";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE_NAME = "refreshToken";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching JWT_REFRESH_EXPIRY
});

export const registerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const result = await authService.register(validatedData);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    res.status(201).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());
    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await authService.refresh(refreshToken);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await authService.logout(req.userId);
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions());
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const meHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      userId: req.userId,
      message: "You are authenticated",
    },
  });
};
