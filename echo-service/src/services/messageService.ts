import { Types } from "mongoose";
import Message, { IMessage } from "../models/Message";
import Conversation from "../models/Conversation";
import { AppError } from "../middlewares/errorHandler";

export const messagePopulation = [
  { path: "senderId", select: "_id username avatarUrl" },
  {
    path: "replyTo",
    select: "_id content senderId type mediaUrl fileName",
    populate: { path: "senderId", select: "_id username avatarUrl" },
  },
  { path: "reactions.users", select: "_id username avatarUrl" },
];

export interface CreateMessageDTO {
  conversationId: string;
  content?: string;
  type?: "text" | "image" | "file";
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  replyTo?: string | null;
}

export const createMessage = async (
  userId: string,
  dto: CreateMessageDTO
): Promise<IMessage> => {
  if (!Types.ObjectId.isValid(dto.conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  const content = dto.content ? dto.content.trim() : "";
  const hasMedia = !!dto.mediaUrl;

  if (!content && !hasMedia) {
    throw new AppError("Message content or media is required", 400);
  }

  const conversation = await Conversation.findById(dto.conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant = conversation.participants.some(
    (pid) => pid.toString() === userId
  );

  if (!isParticipant) {
    throw new AppError("Access denied: You are not a participant in this conversation", 403);
  }

  if (dto.replyTo) {
    if (!Types.ObjectId.isValid(dto.replyTo)) {
      throw new AppError("Invalid replyTo message ID", 400);
    }
    const parentMsg = await Message.findById(dto.replyTo);
    if (!parentMsg || parentMsg.conversationId.toString() !== dto.conversationId) {
      throw new AppError("Referenced reply message not found in this conversation", 404);
    }
  }

  const userObjectId = new Types.ObjectId(userId);
  const conversationObjectId = new Types.ObjectId(dto.conversationId);

  const message = await Message.create({
    conversationId: conversationObjectId,
    senderId: userObjectId,
    content: content,
    type: dto.type || (hasMedia ? "file" : "text"),
    mediaUrl: dto.mediaUrl || null,
    fileName: dto.fileName || null,
    fileSize: dto.fileSize || null,
    replyTo: dto.replyTo ? new Types.ObjectId(dto.replyTo) : null,
    reactions: [],
    readBy: [userObjectId],
    status: "sent",
  });

  // Update conversation lastMessage reference and updatedAt
  conversation.lastMessage = message._id as Types.ObjectId;
  await conversation.save();

  const populated = await Message.findById(message._id)
    .populate(messagePopulation);

  return populated!;
};

/**
 * Toggles an emoji reaction for a user on a given message.
 * - If the user has already reacted with the emoji, remove their ID.
 * - If no users remain for that emoji, remove the reaction entry.
 * - If the user has not reacted, append their user ID.
 */
export const toggleReaction = async (
  messageId: string,
  userId: string,
  emoji: string
): Promise<IMessage> => {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new AppError("Invalid message ID", 400);
  }

  if (!emoji || emoji.trim().length === 0) {
    throw new AppError("Emoji is required", 400);
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw new AppError("Message not found", 404);
  }

  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant = conversation.participants.some(
    (pid) => pid.toString() === userId
  );

  if (!isParticipant) {
    throw new AppError("Access denied: You are not a participant in this conversation", 403);
  }

  const userObjectId = new Types.ObjectId(userId);
  const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

  if (reactionIndex > -1) {
    const existing = message.reactions[reactionIndex];
    const userIndex = existing.users.findIndex(
      (u) => u.toString() === userId
    );

    if (userIndex > -1) {
      // User already reacted -> remove their reaction
      existing.users.splice(userIndex, 1);
      if (existing.users.length === 0) {
        message.reactions.splice(reactionIndex, 1);
      }
    } else {
      // User hasn't reacted with this emoji -> add
      existing.users.push(userObjectId);
    }
  } else {
    // New reaction emoji
    message.reactions.push({
      emoji,
      users: [userObjectId],
    });
  }

  await message.save();

  const populated = await Message.findById(message._id)
    .populate(messagePopulation);

  return populated!;
};

export const markMessagesAsRead = async (
  userId: string,
  conversationId: string,
  messageIds: string[]
): Promise<string[]> => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return [];
  }

  const validMessageObjectIds = messageIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validMessageObjectIds.length === 0) {
    return [];
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant = conversation.participants.some(
    (pid) => pid.toString() === userId
  );

  if (!isParticipant) {
    throw new AppError("Access denied: You are not a participant in this conversation", 403);
  }

  const userObjectId = new Types.ObjectId(userId);

  // Update messages where user is not in readBy array
  await Message.updateMany(
    {
      _id: { $in: validMessageObjectIds },
      conversationId: new Types.ObjectId(conversationId),
    },
    {
      $addToSet: { readBy: userObjectId },
      $set: { status: "read" },
    }
  );

  return validMessageObjectIds.map((id) => id.toString());
};
