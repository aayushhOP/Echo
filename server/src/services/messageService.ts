import { Types } from "mongoose";
import Message, { IMessage } from "../models/Message";
import Conversation from "../models/Conversation";
import { AppError } from "../middlewares/errorHandler";

export interface CreateMessageDTO {
  conversationId: string;
  content: string;
  type?: "text" | "image" | "file";
  mediaUrl?: string;
}

export const createMessage = async (
  userId: string,
  dto: CreateMessageDTO
): Promise<IMessage> => {
  if (!Types.ObjectId.isValid(dto.conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  if (!dto.content || dto.content.trim().length === 0) {
    throw new AppError("Message content cannot be empty", 400);
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

  const userObjectId = new Types.ObjectId(userId);
  const conversationObjectId = new Types.ObjectId(dto.conversationId);

  const message = await Message.create({
    conversationId: conversationObjectId,
    senderId: userObjectId,
    content: dto.content.trim(),
    type: dto.type || "text",
    mediaUrl: dto.mediaUrl,
    readBy: [userObjectId],
    status: "sent",
  });

  // Update conversation lastMessage reference and updatedAt
  conversation.lastMessage = message._id as Types.ObjectId;
  await conversation.save();

  const populated = await Message.findById(message._id)
    .populate("senderId", "_id username avatarUrl");

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
