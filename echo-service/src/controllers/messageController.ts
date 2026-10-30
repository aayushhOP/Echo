import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import { uploadFile } from "../services/uploadService";

export const uploadMessageHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }

    if (!req.file) {
      throw new AppError("No file provided in field 'file'", 400);
    }

    const fileResult = await uploadFile(req, req.file);

    res.status(200).json(fileResult);
  } catch (error) {
    next(error);
  }
};
