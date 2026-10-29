import { Types } from "mongoose";
import Conversation, { IConversation } from "../models/Conversation";
import Message, { IMessage } from "../models/Message";
import User from "../models/User";
import { AppError } from "../middlewares/errorHandler";
import {
  CreateConversationDTO,
  UpdateConversationDTO,
  MessageQueryDTO,
} from "../types/conversation";

export const getConversationsForUser = async (userId: string) => {
  const userObjectId = new Types.ObjectId(userId);
  const conversations = await Conversation.find({
    participants: userObjectId,
  })
    .populate("participants", "_id username avatarUrl status isOnline lastSeen")
    .populate("admins", "_id username avatarUrl")
    .populate("lastMessage")
    .sort({ updatedAt: -1 });

  return conversations;
};

export const getConversationById = async (conversationId: string, userId: string) => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  const conversation = await Conversation.findById(conversationId)
    .populate("participants", "_id username avatarUrl status isOnline lastSeen")
    .populate("admins", "_id username avatarUrl")
    .populate("lastMessage");

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant = conversation.participants.some(
    (p: any) => p._id.toString() === userId || p.toString() === userId
  );

  if (!isParticipant) {
    throw new AppError("Access denied: You are not a participant in this conversation", 403);
  }

  return conversation;
};

export const createConversation = async (
  userId: string,
  dto: CreateConversationDTO
): Promise<{ conversation: IConversation; isNew: boolean }> => {
  const currentUserId = new Types.ObjectId(userId);

  if (dto.type === "direct") {
    if (!dto.participantId) {
      throw new AppError("participantId is required for direct conversation", 400);
    }
    if (!Types.ObjectId.isValid(dto.participantId)) {
      throw new AppError("Invalid participantId", 400);
    }
    if (dto.participantId === userId) {
      throw new AppError("Cannot create a direct conversation with yourself", 400);
    }

    const otherUser = await User.findById(dto.participantId);
    if (!otherUser) {
      throw new AppError("Participant user not found", 404);
    }

    const otherUserId = new Types.ObjectId(dto.participantId);

    // Rule: Check whether a direct conversation between the same two users already exists
    const existingConversation = await Conversation.findOne({
      type: "direct",
      participants: { $all: [currentUserId, otherUserId] },
    })
      .populate("participants", "_id username avatarUrl status isOnline lastSeen")
      .populate("lastMessage");

    if (existingConversation) {
      return { conversation: existingConversation, isNew: false };
    }

    // Create new direct conversation
    const newConversation = await Conversation.create({
      type: "direct",
      participants: [currentUserId, otherUserId],
    });

    const populated = await Conversation.findById(newConversation._id).populate(
      "participants",
      "_id username avatarUrl status isOnline lastSeen"
    );

    return { conversation: populated!, isNew: true };
  }

  if (dto.type === "group") {
    if (!dto.groupName || dto.groupName.trim().length === 0) {
      throw new AppError("groupName is required for group conversations", 400);
    }

    if (!dto.participantIds || !Array.isArray(dto.participantIds) || dto.participantIds.length === 0) {
      throw new AppError("participantIds array is required for group conversations", 400);
    }

    // Clean and validate participant IDs
    const uniqueIds = Array.from(new Set([...dto.participantIds, userId]));
    for (const pid of uniqueIds) {
      if (!Types.ObjectId.isValid(pid)) {
        throw new AppError(`Invalid participant ID: ${pid}`, 400);
      }
    }

    const validUsersCount = await User.countDocuments({ _id: { $in: uniqueIds } });
    if (validUsersCount !== uniqueIds.length) {
      throw new AppError("One or more participants do not exist", 404);
    }

    const participantObjectIds = uniqueIds.map((id) => new Types.ObjectId(id));

    const newGroup = await Conversation.create({
      type: "group",
      groupName: dto.groupName.trim(),
      participants: participantObjectIds,
      admins: [currentUserId],
    });

    const populated = await Conversation.findById(newGroup._id)
      .populate("participants", "_id username avatarUrl status isOnline lastSeen")
      .populate("admins", "_id username avatarUrl");

    return { conversation: populated!, isNew: true };
  }

  throw new AppError("Invalid conversation type", 400);
};

export const updateConversation = async (
  conversationId: string,
  userId: string,
  dto: UpdateConversationDTO
): Promise<IConversation> => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  if (conversation.type !== "group") {
    throw new AppError("Only group conversations can be updated", 400);
  }

  // Check if current user is an admin or participant
  const isAdmin = conversation.admins?.some((adminId) => adminId.toString() === userId);
  const isParticipant = conversation.participants.some((pid) => pid.toString() === userId);

  if (!isParticipant) {
    throw new AppError("Access denied: You are not a member of this conversation", 403);
  }

  // Only admins can modify group details
  if (!isAdmin) {
    throw new AppError("Only group admins can update group settings", 403);
  }

  if (dto.groupName !== undefined) {
    if (dto.groupName.trim().length === 0) {
      throw new AppError("groupName cannot be empty", 400);
    }
    conversation.groupName = dto.groupName.trim();
  }

  if (dto.addParticipantIds && dto.addParticipantIds.length > 0) {
    for (const pid of dto.addParticipantIds) {
      if (!Types.ObjectId.isValid(pid)) {
        throw new AppError(`Invalid participant ID: ${pid}`, 400);
      }
    }

    const usersToAdd = await User.find({ _id: { $in: dto.addParticipantIds } });
    if (usersToAdd.length !== dto.addParticipantIds.length) {
      throw new AppError("One or more users to add do not exist", 404);
    }

    const currentParticipantSet = new Set(
      conversation.participants.map((id) => id.toString())
    );

    for (const pid of dto.addParticipantIds) {
      if (!currentParticipantSet.has(pid)) {
        conversation.participants.push(new Types.ObjectId(pid));
        currentParticipantSet.add(pid);
      }
    }
  }

  if (dto.removeParticipantIds && dto.removeParticipantIds.length > 0) {
    const toRemoveSet = new Set(dto.removeParticipantIds);

    conversation.participants = conversation.participants.filter(
      (pid) => !toRemoveSet.has(pid.toString())
    );

    if (conversation.admins) {
      conversation.admins = conversation.admins.filter(
        (aid) => !toRemoveSet.has(aid.toString())
      );
    }
  }

  await conversation.save();

  const populated = await Conversation.findById(conversation._id)
    .populate("participants", "_id username avatarUrl status isOnline lastSeen")
    .populate("admins", "_id username avatarUrl")
    .populate("lastMessage");

  return populated!;
};

export const getConversationMessages = async (
  conversationId: string,
  userId: string,
  query: MessageQueryDTO
): Promise<{ messages: IMessage[]; nextCursor: string | null; hasMore: boolean }> => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
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

  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);

  const filter: any = {
    conversationId: new Types.ObjectId(conversationId),
  };

  if (query.before) {
    // If 'before' is a valid ObjectId, we can paginate by _id ($lt) or look up its createdAt
    if (Types.ObjectId.isValid(query.before)) {
      const cursorMessage = await Message.findById(query.before);
      if (cursorMessage) {
        filter.createdAt = { $lt: (cursorMessage as any).createdAt };
      } else {
        // Fallback to ObjectId comparison as Mongo ObjectIds are chronologically ordered
        filter._id = { $lt: new Types.ObjectId(query.before) };
      }
    } else {
      // Check if it's an ISO date string
      const dateCursor = new Date(query.before);
      if (!isNaN(dateCursor.getTime())) {
        filter.createdAt = { $lt: dateCursor };
      } else {
        throw new AppError("Invalid 'before' cursor format", 400);
      }
    }
  }

  // Fetch limit + 1 to determine if there is a next page
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("senderId", "_id username avatarUrl");

  const hasMore = messages.length > limit;
  const returnedMessages = hasMore ? messages.slice(0, limit) : messages;

  const nextCursor =
    hasMore && returnedMessages.length > 0
      ? returnedMessages[returnedMessages.length - 1]._id.toString()
      : null;

  return {
    messages: returnedMessages,
    nextCursor,
    hasMore,
  };
};
