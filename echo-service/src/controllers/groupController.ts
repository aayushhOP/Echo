import { Response, NextFunction } from "express";
import crypto from "crypto";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import Conversation from "../models/Conversation";
import Message from "../models/Message";
import { getIO } from "../sockets";

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
};

/**
 * Helper to ensure conversation has initialized groupParticipants & settings
 */
const ensureGroupInitialized = (conversation: any) => {
  if (!conversation.groupParticipants || conversation.groupParticipants.length === 0) {
    const adminSet = new Set((conversation.admins || []).map((id: any) => id.toString()));
    if (conversation.creatorId) {
      adminSet.add(conversation.creatorId.toString());
    }
    conversation.groupParticipants = (conversation.participants || []).map((pid: any) => {
      const pidStr = pid.toString();
      return {
        userId: pid,
        role: adminSet.has(pidStr) ? "admin" : "member",
        joinedAt: conversation.createdAt || new Date(),
      };
    });
  }

  if (!conversation.settings) {
    conversation.settings = {
      onlyAdminsMessage: false,
      onlyAdminsEditInfo: false,
      onlyAdminsAddMembers: false,
      requireAdminApproval: false,
    };
  }

  if (!conversation.pastParticipants) {
    conversation.pastParticipants = [];
  }

  if (!conversation.pendingRequests) {
    conversation.pendingRequests = [];
  }
};

/**
 * PATCH /api/conversations/:id/settings or /api/groups/:id/settings
 * Toggle messaging, info edits, and join approval rules
 */
export const updateGroupSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const { onlyAdminsMessage, onlyAdminsEditInfo, onlyAdminsAddMembers, requireAdminApproval } = req.body;
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid conversation ID", 400);

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Admins only", 403);
    }

    if (onlyAdminsMessage !== undefined) conversation.settings!.onlyAdminsMessage = !!onlyAdminsMessage;
    if (onlyAdminsEditInfo !== undefined) conversation.settings!.onlyAdminsEditInfo = !!onlyAdminsEditInfo;
    if (onlyAdminsAddMembers !== undefined) conversation.settings!.onlyAdminsAddMembers = !!onlyAdminsAddMembers;
    if (requireAdminApproval !== undefined) conversation.settings!.requireAdminApproval = !!requireAdminApproval;

    await conversation.save();

    // Broadcast updated settings to both conv:${id} and conversation:${id}
    try {
      const io = getIO();
      if (io) {
        const payload = {
          conversationId: id,
          settings: conversation.settings,
        };
        io.to(`conversation:${id}`).emit("group:settings-updated", payload);
        io.to(`conv:${id}`).emit("group:settings-updated", payload);
      }
    } catch (e) {
      // ignore socket broadcast error
    }

    res.status(200).json({ success: true, settings: conversation.settings });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/members/:targetUserId/promote
 * Elevate regular member to Admin
 */
export const promoteMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const targetUserId = getParam(req.params.targetUserId);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError("Invalid ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Only admins can promote members", 403);
    }

    const target = conversation.groupParticipants?.find(
      (p) => p.userId.toString() === targetUserId
    );
    if (!target) {
      throw new AppError("User is not in group", 404);
    }

    target.role = "admin";

    // Synchronize legacy admins array
    const targetObjectId = new Types.ObjectId(targetUserId);
    if (!conversation.admins) conversation.admins = [];
    if (!conversation.admins.some((aid) => aid.toString() === targetUserId)) {
      conversation.admins.push(targetObjectId);
    }

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          conversationId: id,
          promotedUserId: targetUserId,
          promotedByUserId: currentUserId,
        };
        io.to(`conversation:${id}`).emit("group:member-promoted", payload);
        io.to(`conv:${id}`).emit("group:member-promoted", payload);
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Member promoted to admin" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/members/:targetUserId/demote
 * Demote admin to regular member (protected against creator demotion)
 */
export const demoteMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const targetUserId = getParam(req.params.targetUserId);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError("Invalid ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    // Creator cannot be demoted
    if (conversation.creatorId && conversation.creatorId.toString() === targetUserId) {
      throw new AppError("The group creator cannot be demoted", 403);
    }

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Only admins can demote", 403);
    }

    const target = conversation.groupParticipants?.find(
      (p) => p.userId.toString() === targetUserId
    );
    if (!target) {
      throw new AppError("User is not in group", 404);
    }

    target.role = "member";

    // Remove from legacy admins array
    if (conversation.admins) {
      conversation.admins = conversation.admins.filter(
        (aid) => aid.toString() !== targetUserId
      );
    }

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          conversationId: id,
          demotedUserId: targetUserId,
          demotedByUserId: currentUserId,
        };
        io.to(`conversation:${id}`).emit("group:member-demoted", payload);
        io.to(`conv:${id}`).emit("group:member-demoted", payload);
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Admin demoted to regular member" });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/conversations/:id/members/:targetUserId
 * Remove participant from group (protected against creator removal)
 */
export const removeMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const targetUserId = getParam(req.params.targetUserId);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError("Invalid ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    // Creator cannot be kicked
    if (conversation.creatorId && conversation.creatorId.toString() === targetUserId) {
      throw new AppError("The group creator cannot be removed", 403);
    }

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Only admins can remove members", 403);
    }

    const memberIndex = conversation.groupParticipants?.findIndex(
      (p) => p.userId.toString() === targetUserId
    ) ?? -1;

    if (memberIndex === -1) {
      throw new AppError("User is not in group", 404);
    }

    const targetObjectId = new Types.ObjectId(targetUserId);

    // Remove from groupParticipants and participants
    conversation.groupParticipants!.splice(memberIndex, 1);
    conversation.participants = conversation.participants.filter(
      (pid) => pid.toString() !== targetUserId
    );
    if (conversation.admins) {
      conversation.admins = conversation.admins.filter(
        (aid) => aid.toString() !== targetUserId
      );
    }

    // Add to pastParticipants
    if (!conversation.pastParticipants) conversation.pastParticipants = [];
    conversation.pastParticipants.push({
      userId: targetObjectId,
      leftAt: new Date(),
      reason: "removed",
    });

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          conversationId: id,
          removedUserId: targetUserId,
          removedByUserId: currentUserId,
        };
        io.to(`conversation:${id}`).emit("group:member-removed", payload);
        io.to(`conv:${id}`).emit("group:member-removed", payload);
        io.to(`user:${targetUserId}`).emit("group:member-removed", payload);
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Member removed from group" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/leave
 * Participant departure with silent admin alert and auto-succession
 */
export const leaveGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid conversation ID", 400);

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const memberIndex = conversation.groupParticipants!.findIndex(
      (p) => p.userId.toString() === currentUserId
    );
    if (memberIndex === -1) {
      throw new AppError("Not a participant", 400);
    }

    const currentObjectId = new Types.ObjectId(currentUserId);

    // Remove user from active participants and append to past audit list
    conversation.groupParticipants!.splice(memberIndex, 1);
    conversation.participants = conversation.participants.filter(
      (uid) => uid.toString() !== currentUserId
    );
    if (conversation.admins) {
      conversation.admins = conversation.admins.filter(
        (aid) => aid.toString() !== currentUserId
      );
    }

    conversation.pastParticipants!.push({
      userId: currentObjectId,
      leftAt: new Date(),
      reason: "left",
    });

    // Auto-Succession check: if no admins left, elevate the oldest member
    let remainingAdmins = conversation.groupParticipants!.filter((p) => p.role === "admin");
    let autoSuccessorId: string | null = null;

    if (remainingAdmins.length === 0 && conversation.groupParticipants!.length > 0) {
      conversation.groupParticipants!.sort(
        (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      );
      conversation.groupParticipants![0].role = "admin";
      autoSuccessorId = conversation.groupParticipants![0].userId.toString();

      if (!conversation.admins) conversation.admins = [];
      conversation.admins.push(conversation.groupParticipants![0].userId);
      remainingAdmins = [conversation.groupParticipants![0]];
    }

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        if (autoSuccessorId) {
          const successionPayload = {
            conversationId: id,
            promotedUserId: autoSuccessorId,
            reason: "auto-succession",
          };
          io.to(`conversation:${id}`).emit("group:member-promoted", successionPayload);
          io.to(`conv:${id}`).emit("group:member-promoted", successionPayload);
        }

        // WhatsApp Rule: Silent notification dispatched ONLY to remaining admins
        remainingAdmins.forEach((admin) => {
          io.to(`user:${admin.userId.toString()}`).emit("group:user-left-admin-alert", {
            conversationId: id,
            leftUserId: currentUserId,
            timestamp: new Date(),
          });
        });

        // Also emit leave to conversation room to sync participant lists in clients
        io.to(`conversation:${id}`).emit("group:member-left", {
          conversationId: id,
          leftUserId: currentUserId,
        });
        io.to(`conv:${id}`).emit("group:member-left", {
          conversationId: id,
          leftUserId: currentUserId,
        });
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Successfully left group" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/invite-link/generate
 * Creates or resets the group invite link token
 */
export const generateInviteLink = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid conversation ID", 400);

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Admins only", 403);
    }

    const token = crypto.randomBytes(16).toString("hex");
    conversation.inviteToken = token;
    await conversation.save();

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

    res.status(200).json({
      success: true,
      inviteUrl: `${clientOrigin}/invite/${token}`,
      inviteToken: token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations/invite/:token
 * Lookup group info by invite token
 */
export const getGroupByInviteToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getParam(req.params.token);

  try {
    if (!token) throw new AppError("Token is required", 400);

    const conversation = await Conversation.findOne({ inviteToken: token })
      .populate("participants", "_id username avatarUrl status")
      .populate("creatorId", "_id username avatarUrl");

    if (!conversation) {
      throw new AppError("Invalid or expired invite link", 404);
    }

    res.status(200).json({
      success: true,
      group: {
        _id: conversation._id,
        name: conversation.groupName || conversation.name,
        groupName: conversation.groupName || conversation.name,
        description: conversation.description,
        avatarUrl: conversation.groupAvatar || conversation.avatarUrl,
        groupAvatar: conversation.groupAvatar || conversation.avatarUrl,
        memberCount: conversation.participants.length,
        settings: conversation.settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/invite/:token/join
 * Join group via invite token (or request approval if requireAdminApproval is on)
 */
export const joinGroupByInviteToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = getParam(req.params.token);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!token) throw new AppError("Token is required", 400);

    const conversation = await Conversation.findOne({ inviteToken: token });
    if (!conversation) {
      throw new AppError("Invalid or expired invite link", 404);
    }

    ensureGroupInitialized(conversation);

    const currentObjectId = new Types.ObjectId(currentUserId);

    // Check if already participant
    if (conversation.participants.some((pid) => pid.toString() === currentUserId)) {
      res.status(200).json({
        success: true,
        message: "Already a member of this group",
        conversationId: conversation._id,
      });
      return;
    }

    // Check approval requirement
    if (conversation.settings?.requireAdminApproval) {
      if (!conversation.pendingRequests) conversation.pendingRequests = [];
      if (!conversation.pendingRequests.some((uid) => uid.toString() === currentUserId)) {
        conversation.pendingRequests.push(currentObjectId);
        await conversation.save();

        // Alert admins of pending request
        try {
          const io = getIO();
          if (io) {
            const adminParticipants = conversation.groupParticipants?.filter((p) => p.role === "admin") || [];
            adminParticipants.forEach((admin) => {
              io.to(`user:${admin.userId.toString()}`).emit("group:join-request", {
                conversationId: conversation._id.toString(),
                requestedUserId: currentUserId,
              });
            });
          }
        } catch (e) {}
      }

      res.status(200).json({
        success: true,
        pendingApproval: true,
        message: "Join request submitted for admin approval",
      });
      return;
    }

    // Add directly to group
    conversation.participants.push(currentObjectId);
    conversation.groupParticipants!.push({
      userId: currentObjectId,
      role: "member",
      joinedAt: new Date(),
    });

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          conversationId: conversation._id.toString(),
          joinedUserId: currentUserId,
        };
        io.to(`conversation:${conversation._id}`).emit("group:member-joined", payload);
        io.to(`conv:${conversation._id}`).emit("group:member-joined", payload);
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      joined: true,
      conversationId: conversation._id,
      message: "Successfully joined group",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/requests/:targetUserId/approve
 * Approve pending join request
 */
export const approveJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const targetUserId = getParam(req.params.targetUserId);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError("Invalid ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Only admins can approve join requests", 403);
    }

    const requestIndex = conversation.pendingRequests!.findIndex(
      (uid) => uid.toString() === targetUserId
    );
    if (requestIndex === -1) {
      throw new AppError("No pending request found for this user", 404);
    }

    conversation.pendingRequests!.splice(requestIndex, 1);
    const targetObjectId = new Types.ObjectId(targetUserId);

    if (!conversation.participants.some((pid) => pid.toString() === targetUserId)) {
      conversation.participants.push(targetObjectId);
      conversation.groupParticipants!.push({
        userId: targetObjectId,
        role: "member",
        joinedAt: new Date(),
      });
    }

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        io.to(`user:${targetUserId}`).emit("group:join-approved", {
          conversationId: id,
        });
        io.to(`conversation:${id}`).emit("group:member-joined", {
          conversationId: id,
          joinedUserId: targetUserId,
        });
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Join request approved" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/requests/:targetUserId/reject
 * Reject pending join request
 */
export const rejectJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const targetUserId = getParam(req.params.targetUserId);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(targetUserId)) {
      throw new AppError("Invalid ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    ensureGroupInitialized(conversation);

    const isCurrentAdmin =
      conversation.groupParticipants?.some(
        (p) => p.userId.toString() === currentUserId && p.role === "admin"
      ) ||
      conversation.admins?.some((aid) => aid.toString() === currentUserId) ||
      conversation.creatorId?.toString() === currentUserId;

    if (!isCurrentAdmin) {
      throw new AppError("Only admins can reject join requests", 403);
    }

    conversation.pendingRequests = conversation.pendingRequests!.filter(
      (uid) => uid.toString() !== targetUserId
    );

    await conversation.save();

    try {
      const io = getIO();
      if (io) {
        io.to(`user:${targetUserId}`).emit("group:join-rejected", {
          conversationId: id,
        });
      }
    } catch (e) {}

    res.status(200).json({ success: true, message: "Join request rejected" });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/conversations/:id/delete-group or /api/groups/:id
 * Permanently deletes the group, all its messages, and broadcasts conversation:deleted to all participants.
 * Only the creator of the group is authorized to perform this operation.
 */
export const deleteGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = getParam(req.params.id);
  const currentUserId = req.userId;

  try {
    if (!currentUserId) throw new AppError("Authentication required", 401);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid group ID provided", 400);
    }

    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.type !== "group") {
      throw new AppError("Group not found", 404);
    }

    const creatorIdStr = conversation.creatorId
      ? typeof conversation.creatorId === "string"
        ? conversation.creatorId
        : (conversation.creatorId as any)._id?.toString() || (conversation.creatorId as any).toString()
      : null;

    if (!creatorIdStr || creatorIdStr !== currentUserId) {
      throw new AppError("Only the group creator can delete this group", 403);
    }

    // Capture participants list before deletion for broadcast
    const participantIds = (conversation.participants || []).map((p: any) =>
      typeof p === "string" ? p : p._id?.toString() || p.toString()
    );

    // 1. Delete all messages associated with the conversation
    await Message.deleteMany({ conversationId: new Types.ObjectId(id) });

    // 2. Delete the conversation document itself
    await Conversation.findByIdAndDelete(id);

    // 3. Broadcast real-time deletion event
    try {
      const io = getIO();
      if (io) {
        // Emit to conversation room (for anyone currently inside the chat)
        io.to(`conversation:${id}`).emit("conversation:deleted", {
          conversationId: id,
        });
        io.to(`conv:${id}`).emit("conversation:deleted", {
          conversationId: id,
        });

        // Also emit directly to every participant's personal room
        participantIds.forEach((pId: string) => {
          io.to(`user:${pId}`).emit("conversation:deleted", {
            conversationId: id,
          });
        });
      }
    } catch {
      // Socket broadcast failure shouldn't fail HTTP response
    }

    res.status(200).json({
      success: true,
      message: "Group and its messages permanently deleted",
    });
  } catch (error) {
    next(error);
  }
};
