import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import Conversation from "../models/Conversation";
import { AuthenticatedRequest } from "./authMiddleware";
import { AppError } from "./errorHandler";

export const requireGroupAdmin = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  const currentUserId = req.userId;
  const conversationId = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) ||
    (Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId);

  if (!currentUserId) {
    return next(new AppError("Authentication required", 401));
  }

  if (!conversationId || typeof conversationId !== "string" || !Types.ObjectId.isValid(conversationId)) {
    return next(new AppError("Invalid group ID", 400));
  }

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== "group") {
      return next(new AppError("Group not found", 404));
    }

    const currentObjectId = new Types.ObjectId(currentUserId);

    // Check admin via groupParticipants or admins array
    const isParticipantAdmin = conversation.groupParticipants?.some(
      (p) => p.userId.toString() === currentUserId && p.role === "admin"
    );
    const isAdminsListAdmin = conversation.admins?.some(
      (adminId) => adminId.toString() === currentUserId
    );
    const isCreator = conversation.creatorId?.toString() === currentUserId;

    if (!isParticipantAdmin && !isAdminsListAdmin && !isCreator) {
      return next(new AppError("Action requires group administrator privileges", 403));
    }

    (req as any).group = conversation;
    next();
  } catch (err: any) {
    return next(new AppError(err.message || "Internal permission verification error", 500));
  }
};
