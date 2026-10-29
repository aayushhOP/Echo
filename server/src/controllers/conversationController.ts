import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import * as conversationService from "../services/conversationService";

const createConversationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("direct"),
    participantId: z.string().min(1, "participantId is required"),
  }),
  z.object({
    type: z.literal("group"),
    groupName: z.string().trim().min(1, "groupName cannot be empty").max(50),
    participantIds: z.array(z.string()).min(1, "At least one participant required"),
  }),
]);

const updateConversationSchema = z
  .object({
    groupName: z.string().trim().min(1).max(50).optional(),
    addParticipantIds: z.array(z.string()).optional(),
    removeParticipantIds: z.array(z.string()).optional(),
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
    const conversation = await conversationService.createConversation(req.userId, validatedData);
    res.status(201).json({
      success: true,
      data: conversation,
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
