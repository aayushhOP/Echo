import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { AppError } from "../middlewares/errorHandler";
import User from "../models/User";

/**
 * GET /api/contacts
 * Returns list of saved contacts populated with current profile avatars, username, and status
 */
export const getSavedContacts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      throw new AppError("Authentication required", 401);
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const contactsList = user.contacts || [];
    if (contactsList.length === 0) {
      res.status(200).json({ success: true, contacts: [] });
      return;
    }

    // Match targets by either clerkId or MongoDB _id
    const contactIdentifiers = contactsList.map((c) => c.contactUserId);
    const validObjectIds = contactIdentifiers
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const liveProfiles = await User.find({
      $or: [
        { clerkId: { $in: contactIdentifiers } },
        { _id: { $in: validObjectIds } },
      ],
    }).select("_id clerkId username avatarUrl status bio phone email isOnline lastSeen");

    const profileMap = new Map<string, any>();
    for (const p of liveProfiles) {
      if (p.clerkId) profileMap.set(p.clerkId, p);
      profileMap.set(p._id.toString(), p);
    }

    const enrichedContacts = contactsList.map((contact) => {
      const profile = profileMap.get(contact.contactUserId);
      return {
        _id: (contact as any)._id,
        contactUserId: contact.contactUserId,
        targetMongoId: profile ? profile._id.toString() : (Types.ObjectId.isValid(contact.contactUserId) ? contact.contactUserId : undefined),
        savedName: contact.savedName,
        email: contact.email || profile?.email || "",
        phoneNumber: contact.phoneNumber || profile?.phone || "",
        username: profile?.username || "",
        avatarUrl: profile?.avatarUrl || "",
        status: profile?.status || "",
        isOnline: profile?.isOnline || false,
        lastSeen: profile?.lastSeen || null,
        savedAt: contact.savedAt,
      };
    });

    res.status(200).json({ success: true, contacts: enrichedContacts });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contacts
 * Adds or updates a contact in the user's address book
 */
export const saveContact = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      throw new AppError("Authentication required", 401);
    }

    const { contactUserId, savedName, email, phoneNumber } = req.body;

    if (!contactUserId || !savedName?.trim()) {
      throw new AppError("Target user ID and saved name are required", 400);
    }

    const user = await User.findById(currentUserId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Target user can be found by _id or clerkId
    let targetUser = null;
    if (Types.ObjectId.isValid(contactUserId)) {
      targetUser = await User.findById(contactUserId);
    }
    if (!targetUser) {
      targetUser = await User.findOne({ clerkId: contactUserId });
    }

    if (!targetUser) {
      throw new AppError("User does not exist", 404);
    }

    if (targetUser._id.toString() === user._id.toString() || targetUser.clerkId === user.clerkId) {
      throw new AppError("You cannot add yourself as a contact", 400);
    }

    if (!user.contacts) {
      user.contacts = [];
    }

    // Match existing contact by contactUserId, target clerkId, or target mongoId
    const existingIndex = user.contacts.findIndex(
      (c) =>
        c.contactUserId === contactUserId ||
        c.contactUserId === targetUser?.clerkId ||
        c.contactUserId === targetUser?._id.toString()
    );

    if (existingIndex > -1) {
      user.contacts[existingIndex].savedName = savedName.trim();
      user.contacts[existingIndex].email = email?.trim() || "";
      user.contacts[existingIndex].phoneNumber = phoneNumber?.trim() || "";
    } else {
      user.contacts.push({
        contactUserId: targetUser.clerkId || contactUserId,
        savedName: savedName.trim(),
        email: email?.trim() || "",
        phoneNumber: phoneNumber?.trim() || "",
        savedAt: new Date(),
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Contact saved successfully",
      contact: {
        contactUserId: targetUser.clerkId || contactUserId,
        targetMongoId: targetUser._id.toString(),
        savedName: savedName.trim(),
        email: email?.trim() || targetUser.email,
        phoneNumber: phoneNumber?.trim() || targetUser.phone || "",
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl,
        status: targetUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/contacts/:contactUserId
 * Removes a contact from the address book
 */
export const deleteContact = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      throw new AppError("Authentication required", 401);
    }

    const rawParam = req.params.contactUserId;
    const contactUserId = Array.isArray(rawParam) ? rawParam[0] : (rawParam || "");

    if (!contactUserId) {
      throw new AppError("contactUserId is required", 400);
    }

    // Resolve target to match both clerkId and mongoId if exists
    let targetClerkId = contactUserId;
    let targetMongoId = contactUserId;

    if (Types.ObjectId.isValid(contactUserId)) {
      const targetUser = await User.findById(contactUserId);
      if (targetUser) {
        targetClerkId = targetUser.clerkId;
      }
    } else {
      const targetUser = await User.findOne({ clerkId: contactUserId });
      if (targetUser) {
        targetMongoId = targetUser._id.toString();
      }
    }

    await User.findByIdAndUpdate(currentUserId, {
      $pull: {
        contacts: {
          contactUserId: { $in: [contactUserId, targetClerkId, targetMongoId] },
        },
      },
    });

    res.status(200).json({ success: true, message: "Contact removed" });
  } catch (error) {
    next(error);
  }
};
