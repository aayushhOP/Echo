import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import { uploadFile } from "../services/uploadService";
import * as messageService from "../services/messageService";
import * as conversationService from "../services/conversationService";
import { getIO } from "../sockets";

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

/**
 * PATCH /api/messages/:id/delete-for-everyone
 */
export const deleteForEveryone = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const clerkId = req.auth?.userId;

    const { message, conversationId } = await messageService.deleteMessageForEveryone(
      id as string,
      req.userId,
      clerkId
    );

    // Emit Real-time Socket Event to both conversation room formats
    try {
      const io = getIO();
      if (io) {
        const payload = {
          messageId: message._id,
          conversationId,
          deletedBy: message.deletedBy,
          deletedAt: message.deletedAt,
        };

        io.to(`conversation:${conversationId}`).emit("message:revoked", payload);
        io.to(`conv:${conversationId}`).emit("message:revoked", payload);
      }
    } catch (sockErr) {
      // socket might not be initialized in some test environments
    }

    res.status(200).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/:id/delete-for-me
 */
export const deleteForMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const clerkId = req.auth?.userId;

    const result = await messageService.deleteMessageForMe(
      id as string,
      req.userId,
      clerkId
    );

    res.status(200).json({ success: true, messageId: result.messageId });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:id/undo-delete-for-me
 */
export const undoDeleteForMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const clerkId = req.auth?.userId;

    const result = await messageService.undoDeleteMessageForMe(
      id as string,
      req.userId,
      clerkId
    );

    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/clear
 * Adds current user to deletedForUsers for all messages in the conversation
 */
export const clearChatMessages = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id: conversationId } = req.params;
    const clerkId = req.auth?.userId;

    const result = await messageService.clearConversationChat(
      conversationId as string,
      req.userId,
      clerkId
    );

    res.status(200).json({
      success: true,
      message: "Chat cleared successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations/:id/messages
 * Delegated to conversationService to return filtered messages
 */
export const getConversationMessagesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id: conversationId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;

    const result = await conversationService.getConversationMessages(
      conversationId as string,
      req.userId,
      { limit, before }
    );

    res.status(200).json({
      success: true,
      messages: result.messages,
      data: result.messages,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    next(error);
  }
};
