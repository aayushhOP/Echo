import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import * as conversationService from "../services/conversationService";
import Conversation from "../models/Conversation";

const createConversationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("direct"),
    participantId: z.string().min(1, "participantId is required"),
  }),
  z.object({
    type: z.literal("group"),
    groupName: z.string().trim().min(1, "groupName cannot be empty").max(50),
    participantIds: z.array(z.string()).optional(),
    participants: z.array(z.string()).optional(),
  }).refine((data) => (data.participants && data.participants.length > 0) || (data.participantIds && data.participantIds.length > 0), {
    message: "At least one participant is required",
  }),
]);

const updateConversationSchema = z
  .object({
    groupName: z.string().trim().min(1).max(50).optional(),
    addParticipantIds: z.array(z.string()).optional(),
    removeParticipantIds: z.array(z.string()).optional(),
    addParticipants: z.array(z.string()).optional(),
    removeParticipants: z.array(z.string()).optional(),
  })
  .strict();

export const getConversationsHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const conversations = await conversationService.getConversationsForUser(req.userId);
    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const conversation = await conversationService.getConversationById(id as string, req.userId);
    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const createConversationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const validatedData = createConversationSchema.parse(req.body);
    const result = await conversationService.createConversation(req.userId, validatedData);
    res.status(result.isNew ? 201 : 200).json({
      success: true,
      data: result.conversation,
    });
  } catch (error) {
    next(error);
  }
};

export const updateConversationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const validatedData = updateConversationSchema.parse(req.body);
    const updatedConversation = await conversationService.updateConversation(
      id as string,
      req.userId,
      validatedData
    );
    res.status(200).json({
      success: true,
      data: updatedConversation,
    });
  } catch (error) {
    next(error);
  }
};

export const getMessagesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;

    const result = await conversationService.getConversationMessages(id as string, req.userId, {
      before,
      limit,
    });

    res.status(200).json({
      success: true,
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

export const getConversationMediaHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const type = req.query.type === "image" || req.query.type === "file" ? req.query.type : undefined;

    const result = await conversationService.getConversationMedia(id as string, req.userId, {
      type,
      limit,
      cursor,
    });

    res.status(200).json({
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
};

export const pinConversationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const isPinned = await conversationService.togglePinConversation(id as string, req.userId);
    res.status(200).json({
      conversationId: id,
      isPinned,
    });
  } catch (error) {
    next(error);
  }
};

export const muteConversationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const isMuted = await conversationService.toggleMuteConversation(id as string, req.userId);
    res.status(200).json({
      conversationId: id,
      isMuted,
    });
  } catch (error) {
    next(error);
  }
};

const markConversationReadSchema = z.object({
  messageIds: z.array(z.string()).optional(),
});

export const markConversationAsReadHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id: conversationId } = req.params;
    const parsed = markConversationReadSchema.safeParse(req.body);
    const messageIds = parsed.success ? parsed.data.messageIds : undefined;

    const messageService = await import("../services/messageService.js");
    const updatedIds = await messageService.markMessagesAsRead(
      req.userId,
      conversationId as string,
      messageIds
    );

    // If socket server is available, broadcast update to conversation room and participants
    try {
      const { getIO } = await import("../sockets/index.js");
      const io = getIO();
      if (io && updatedIds.length > 0) {
        io.to(`conversation:${conversationId}`).emit("message:read:update", {
          conversationId,
          messageIds: updatedIds,
          readerId: req.userId,
        });
        io.to(`conversation:${conversationId}`).emit("message:status_batch_update", {
          conversationId,
          messageIds: updatedIds,
          status: "read",
          readByUserId: req.userId,
        });

        // Also broadcast to user rooms
        const conv = await Conversation.findById(conversationId);
        if (conv) {
          for (const pid of conv.participants) {
            const pidStr = pid.toString();
            if (pidStr !== req.userId) {
              io.to(`user:${pidStr}`).emit("message:status_batch_update", {
                conversationId,
                messageIds: updatedIds,
                status: "read",
                readByUserId: req.userId,
              });
              io.to(`user:${pidStr}`).emit("message:read:update", {
                conversationId,
                messageIds: updatedIds,
                readerId: req.userId,
              });
            }
          }
        }
      }
    } catch (sockErr) {
      // Sockets may not be initialized in some test environments; ignore safely
    }

    res.status(200).json({
      success: true,
      data: {
        conversationId,
        updatedCount: updatedIds.length,
        messageIds: updatedIds,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteConversationHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    await conversationService.deleteConversation(id as string, req.userId);

    // Broadcast conversation deletion to participants if socket server is initialized
    try {
      const { getIO } = await import("../sockets/index.js");
      const io = getIO();
      if (io) {
        io.to(`conversation:${id}`).emit("conversation:deleted", {
          conversationId: id,
        });
      }
    } catch {
      // ignore socket broadcast error
    }

    res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const deleteSelectedMessagesSchema = z.object({
  messageIds: z.array(z.string()).min(1, "At least one message ID is required"),
});

export const deleteSelectedMessagesHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      throw new AppError("Authentication required", 401);
    }
    const { id } = req.params;
    const validatedData = deleteSelectedMessagesSchema.parse(req.body);

    const deletedIds = await conversationService.deleteSelectedMessages(
      id as string,
      req.userId,
      validatedData.messageIds
    );

    // Broadcast messages deletion via socket
    try {
      const { getIO } = await import("../sockets/index.js");
      const io = getIO();
      if (io && deletedIds.length > 0) {
        io.to(`conversation:${id}`).emit("messages:batch_removed", {
          conversationId: id,
          messageIds: deletedIds,
        });
      }
    } catch {
      // ignore socket broadcast error
    }

    res.status(200).json({
      success: true,
      message: "Messages deleted",
      data: {
        conversationId: id,
        messageIds: deletedIds,
      },
    });
  } catch (error) {
    next(error);
  }
};

