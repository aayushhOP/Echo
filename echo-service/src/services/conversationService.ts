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

export const messagePopulation = [
  { path: "senderId", select: "_id username avatarUrl" },
  {
    path: "replyTo",
    select: "_id content senderId type mediaUrl fileName",
    populate: { path: "senderId", select: "_id username avatarUrl" },
  },
  { path: "reactions.users", select: "_id username avatarUrl" },
];

export const getConversationsForUser = async (userId: string) => {
  const userObjectId = new Types.ObjectId(userId);
  const conversations = await Conversation.find({
    participants: userObjectId,
  })
    .populate("participants", "_id username avatarUrl status bio phone isOnline lastSeen")
    .populate("admins", "_id username avatarUrl")
    .populate({
      path: "lastMessage",
      populate: { path: "senderId", select: "_id username avatarUrl" },
    })
    .sort({ updatedAt: -1 });

  // Calculate unreadCount, isPinned, isMuted for each conversation
  const results = await Promise.all(
    conversations.map(async (conv) => {
      const convObj: any = conv.toObject();

      // Count unread messages where user is not in readBy array
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
      });

      const isPinned = Array.isArray(conv.pinnedBy)
        ? conv.pinnedBy.some((id: any) => id.toString() === userId)
        : false;

      const isMuted = Array.isArray(conv.mutedBy)
        ? conv.mutedBy.some((id: any) => id.toString() === userId)
        : false;

      return {
        ...convObj,
        unreadCount,
        isPinned,
        isMuted,
      };
    })
  );

  return results;
};

export const getConversationById = async (conversationId: string, userId: string) => {
  if (!Types.ObjectId.isValid(conversationId)) {
    throw new AppError("Invalid conversation ID", 400);
  }

  const conversation = await Conversation.findById(conversationId)
    .populate("participants", "_id username avatarUrl status bio phone isOnline lastSeen")
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

    const rawParticipantIds = dto.participants || dto.participantIds;
    if (!rawParticipantIds || !Array.isArray(rawParticipantIds) || rawParticipantIds.length === 0) {
      throw new AppError("participants array is required for group conversations", 400);
    }

    // Clean and validate participant IDs
    const uniqueIds = Array.from(new Set([...rawParticipantIds, userId]));
    if (uniqueIds.length < 2) {
      throw new AppError("Group conversation requires at least 2 participants", 400);
    }

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

  const toAdd = dto.addParticipants || dto.addParticipantIds;
  if (toAdd && toAdd.length > 0) {
    for (const pid of toAdd) {
      if (!Types.ObjectId.isValid(pid)) {
        throw new AppError(`Invalid participant ID: ${pid}`, 400);
      }
    }

    const usersToAdd = await User.find({ _id: { $in: toAdd } });
    if (usersToAdd.length !== toAdd.length) {
      throw new AppError("One or more users to add do not exist", 404);
    }

    const currentParticipantSet = new Set(
      conversation.participants.map((id) => id.toString())
    );

    for (const pid of toAdd) {
      if (!currentParticipantSet.has(pid)) {
        conversation.participants.push(new Types.ObjectId(pid));
        currentParticipantSet.add(pid);
      }
    }
  }

  const toRemove = dto.removeParticipants || dto.removeParticipantIds;
  if (toRemove && toRemove.length > 0) {
    const toRemoveSet = new Set(toRemove);

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

  const convObjectId = new Types.ObjectId(conversationId);
  const userObjectId = new Types.ObjectId(userId);

  // Fast existence check using index-covered participant query
  const isParticipant = await Conversation.exists({
    _id: convObjectId,
    participants: userObjectId,
  });

  if (!isParticipant) {
    // Distinguish between not found and unauthorized
    const exists = await Conversation.exists({ _id: convObjectId });
    if (!exists) {
      throw new AppError("Conversation not found", 404);
    }
    throw new AppError("Access denied: You are not a participant in this conversation", 403);
  }

  const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);

  const filter: any = {
    conversationId: convObjectId,
  };

  if (query.before) {
    if (Types.ObjectId.isValid(query.before)) {
      // Direct ObjectId timestamp boundary or lookup
      const cursorObjId = new Types.ObjectId(query.before);
      const cursorMessage = await Message.findById(cursorObjId, { createdAt: 1 }).lean();
      if (cursorMessage && (cursorMessage as any).createdAt) {
        filter.createdAt = { $lt: (cursorMessage as any).createdAt };
      } else {
        filter._id = { $lt: cursorObjId };
      }
    } else {
      // ISO date string
      const dateCursor = new Date(query.before);
      if (!isNaN(dateCursor.getTime())) {
        filter.createdAt = { $lt: dateCursor };
      } else {
        throw new AppError("Invalid 'before' cursor format", 400);
      }
    }
  }

  // Fetch limit + 1 to determine if there is a next page with .lean() for high-performance POJO serialization
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate(messagePopulation)
    .lean<IMessage[]>();

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

export const togglePinConversation = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
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

  const userObjectId = new Types.ObjectId(userId);
  if (!Array.isArray(conversation.pinnedBy)) {
    conversation.pinnedBy = [];
  }

  const index = conversation.pinnedBy.findIndex((id) => id.toString() === userId);
  let isPinned = false;

  if (index > -1) {
    conversation.pinnedBy.splice(index, 1);
    isPinned = false;
  } else {
    conversation.pinnedBy.push(userObjectId);
    isPinned = true;
  }

  await conversation.save();
  return isPinned;
};

export const toggleMuteConversation = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
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

  const userObjectId = new Types.ObjectId(userId);
  if (!Array.isArray(conversation.mutedBy)) {
    conversation.mutedBy = [];
  }

  const index = conversation.mutedBy.findIndex((id) => id.toString() === userId);
  let isMuted = false;

  if (index > -1) {
    conversation.mutedBy.splice(index, 1);
    isMuted = false;
  } else {
    conversation.mutedBy.push(userObjectId);
    isMuted = true;
  }

  await conversation.save();
  return isMuted;
};

export const getConversationMedia = async (
  conversationId: string,
  userId: string,
  query: { type?: "image" | "file"; limit?: number; cursor?: string }
): Promise<{ items: IMessage[]; nextCursor: string | null }> => {
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
    mediaUrl: { $ne: null, $exists: true },
  };

  if (query.type) {
    filter.type = query.type;
  } else {
    filter.type = { $in: ["image", "file"] };
  }

  if (query.cursor) {
    if (Types.ObjectId.isValid(query.cursor)) {
      const cursorMessage = await Message.findById(query.cursor);
      if (cursorMessage) {
        filter.createdAt = { $lt: (cursorMessage as any).createdAt };
      } else {
        filter._id = { $lt: new Types.ObjectId(query.cursor) };
      }
    }
  }

  const items = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("senderId", "_id username avatarUrl");

  const hasMore = items.length > limit;
  const returnedItems = hasMore ? items.slice(0, limit) : items;

  const nextCursor =
    hasMore && returnedItems.length > 0
      ? returnedItems[returnedItems.length - 1]._id.toString()
      : null;

  return {
    items: returnedItems,
    nextCursor,
  };
};
