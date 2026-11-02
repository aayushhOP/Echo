import { User } from "../types/user";
import { ConversationParticipant } from "../types/message";

/**
 * Reliably checks if a given participant represents the current authenticated user.
 * Compares Mongo _id, string id, clerkId, and fallback email/username matching.
 */
export function isSameUser(
  participant: User | ConversationParticipant | string | null | undefined,
  currentUser: User | null | undefined
): boolean {
  if (!participant || !currentUser) return false;

  const currentMongoId = currentUser._id || currentUser.id;
  const currentClerkId = currentUser.clerkId;
  const currentEmail = currentUser.email?.toLowerCase();
  const currentUsername = currentUser.username?.toLowerCase();

  // If participant is just a string ID
  if (typeof participant === "string") {
    return (
      participant === currentMongoId ||
      (Boolean(currentClerkId) && participant === currentClerkId)
    );
  }

  const pMongoId = participant._id || participant.id;
  const pClerkId = (participant as any).clerkId;
  const pEmail = (participant as any).email?.toLowerCase();
  const pUsername = participant.username?.toLowerCase();

  // 1. Direct ID match
  if (currentMongoId && pMongoId && currentMongoId === pMongoId) {
    return true;
  }

  // 2. Clerk ID match
  if (currentClerkId && pClerkId && currentClerkId === pClerkId) {
    return true;
  }

  // 3. Fallback: If both IDs are available on both sides, and neither matched, not same user
  if (currentMongoId && pMongoId && currentMongoId !== pMongoId && !pClerkId) {
    // If one is clerkId and other is mongoId, check if participant._id matches clerkId
    if (currentClerkId && pMongoId === currentClerkId) {
      return true;
    }
  }

  // 4. Secondary fallback: Email match if populated
  if (currentEmail && pEmail && currentEmail === pEmail) {
    return true;
  }

  // 5. Username match only if exact match and username isn't a generic fallback like "User"
  if (
    currentUsername &&
    pUsername &&
    currentUsername === pUsername &&
    currentUsername !== "user"
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the counterpart/other participant in a 1-on-1 direct conversation.
 * Guarantees that the current user is never returned as the other participant.
 */
export function getOtherParticipant(
  participants: (User | ConversationParticipant)[] | undefined | null,
  currentUser: User | null | undefined
): User | ConversationParticipant | null {
  if (!participants || participants.length === 0) return null;

  // If there's only 1 participant and they are the current user, return null
  if (participants.length === 1) {
    return isSameUser(participants[0], currentUser) ? null : participants[0];
  }

  // Find the first participant who is NOT the current user
  const other = participants.find((p) => !isSameUser(p, currentUser));
  if (other) {
    return other;
  }

  // If both participants in the direct chat failed strict comparison,
  // pick the one whose ID is definitely not the currentUser's Mongo ID
  const myId = currentUser?._id || currentUser?.id;
  const fallback = participants.find((p) => {
    const pId = p._id || p.id;
    return pId && pId !== myId;
  });

  return fallback || null;
}
